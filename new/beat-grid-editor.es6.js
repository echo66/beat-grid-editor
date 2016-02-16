'use strict';


class BeatGridEditor {

	constructor(uiParams, audioParams) {
		// super();

		const that = this;
		const audioCtx = audioParams.audioCtx;
		const bufferSize = audioParams.bufferSize || 1024;
		const beatGrid = new BeatGrid();

		this._ = {
			audio: {
				bufferCursor: 0, 
				audioCtx: audioCtx, 
				bufferSize: bufferSize, 
				volumes: {
					metronome: 1, 
					player: 1, 
					master: 1, 
				},
				init_audio_graph: () => {
					that._.audio.masterGain = that._.audio.audioCtx.createGain();

					that._.audio.playerNode = that._.audio.audioCtx.createScriptProcessor(that._.audio.bufferSize, 2);
					that._.audio.playerNode.onaudioprocess = function(e) {

						let il = e.inputBuffer.getChannelData(0);
						let ir = e.inputBuffer.getChannelData(1);

						let ol = e.outputBuffer.getChannelData(0);
						let or = e.outputBuffer.getChannelData(1);

						let sr = (that._.audio.audioBuffer.sampleRate || 44100);

						if (that._.audio.audioBuffer) {
							let iil = that._.audio.audioBuffer.getChannelData(0);
							let iir = that._.audio.audioBuffer.getChannelData(1);
							let p = 0;

							for (let i=0; i<that._.audio.bufferSize; i++) {
								p = that._.audio.bufferCursor++;

								let delta = that._.beatGrid.distance_to_closest_beat(p / sr);
								delta = Math.abs(delta * sr);
								let v = ( delta >= 0 && delta <= that._.audio.bufferSize/3)? 1 : 0;
								let x = p / sr;
								let sin = 1 * Math.cos(2 * Math.PI * 600 * x + 0) * v;

								ol[i] = that._.audio.volumes.master * (that._.audio.volumes.player * iil[p] + that._.audio.volumes.metronome * sin);
								or[i] = that._.audio.volumes.master * (that._.audio.volumes.player * iir[p] + that._.audio.volumes.metronome * sin);

								let loopData = that.loop;
								if (loopData !== undefined && that._.audio.bufferCursor / sr > loopData.end) 
									that._.audio.bufferCursor = Math.round(loopData.start * sr);
							}

							// that._.audio.bufferCursor += that._.audio.bufferSize;
							that._.ui.layers.timeCursorLayer.data[0].currentPosition = that._.audio.bufferCursor / (that._.audio.audioBuffer.sampleRate || 44100);
							that._.ui.track.updateLayers([that._.ui.layers.timeCursorLayer]);
						}

					};

					that._.audio.playerNode.connect(that._.audio.masterGain);

				}
			}, 
			ui: {
				$el: uiParams.$el || document.body, 
				layers: {}, 
				style: {
					timeCursor: { color: 'red' }, 
					loop: { color: 'yellow' }, 
					beatGrid: { color: 'orange' }, 
					waveform: { color: 'steelblue' }
				},
				init_ui: ($el) => {
					let $subEl1 = document.createElement('div');
					let $subEl2 = document.createElement('div');
					let $subEl3 = document.createElement('div');
					$el.appendChild($subEl3);
					$el.appendChild($subEl2);
					$el.appendChild($subEl1);

					that._.ui.init_waves_ui($subEl1);
					that._.ui.init_controls($subEl2);

					let width = $subEl3.getBoundingClientRect().width;
					let height = 100;
					let duration = 20;
					let pixelsPerSecond = width / duration;

					that._.ui.scroller = new wavesUI.helpers.Scroller($subEl3, that._.ui.timeline, pixelsPerSecond, width, height)
				},
				init_waves_ui: ($el) => {
					let L = that._.ui.layers;

					let sort_data = (data) => {
						data.sort((a, b) => { return a.x - b.x; }); 
					}

					let visible_data = (timeContext, data) => {
						const fn = function(a,b) {
							return a.time - b.time;
						};

						const t0 = { time: -timeContext.offset };
						const t1 = { time: -timeContext.offset + timeContext.duration };

						let i0 = that._.beatGrid.find_index(data, t0, fn);
						let i1 = that._.beatGrid.find_index(data, t1, fn);

						i0 = (i0.length > 1)? i0[0] : i0[0];
						i1 = (i1.length > 1)? i1[1] : i1[0];

						return [i0, i1];
					}

					$el.innerHTML = '';
					let $track = document.createElement('div');
					$el.appendChild($track);

					let width = $track.getBoundingClientRect().width;
					let height = 200;
					let duration = 20;
					let pixelsPerSecond = width / duration;

					that._.ui.timeline = new wavesUI.core.Timeline(pixelsPerSecond, width);
					that._.ui.timeline.on('event', (e) => {
						if (e.type == 'click') {
							const offset = (-that._.ui.timeline.timeContext.offset);
							const x = that._.ui.timeline.timeContext.timeToPixel.invert(e.x);
							const currentTime = offset + x;
							console.log(currentTime);
							that.currentTime = currentTime;
						}
					});

					that._.ui.timeContext = new wavesUI.core.LayerTimeContext(that._.ui.timeline.timeContext);
					that._.ui.track = new wavesUI.core.Track($track, height);
					that._.ui.timeline.add(that._.ui.track);

					L.timeCursorLayer = new wavesUI.helpers.CursorLayer({ height: height, color: that._.ui.style.timeCursor.color }); // TODO
					L.timeCursorLayer.sort_data = sort_data; L.timeCursorLayer.visible_data = (timeContext, data) => { return [0, data.length-1]; } ; 
					L.timeCursorLayer.setBehavior(new wavesUI.behaviors.BaseBehavior());

					L.beatGridLayer = new wavesUI.helpers.BeatGridLayer([], { height: height }, {
						x: (d, v) => { 
							if (v !== undefined) { 
								d.time = v; 
							} 
							return d.time;
						},
						text: (d, v) => { 
							return (_showBeatMarkersText)? d.time : ''; 
						},
						color: (d, v) => { 
							return that._.ui.style.beatGrid.color; 
						}
					});
					L.beatGridLayer.sort_data = () => {}; L.beatGridLayer.visible_data = visible_data; 
					L.beatGridLayer.set(beatGrid.beatsArray);

					L.waveformLayer = new wavesUI.core.Layer('entity', [], {
						height: height,
						// yDomain: [-1, 1]
						yDomain: [-1, 1]
					});
					L.waveformLayer.configureShape(wavesUI.shapes.Waveform, {}, {
						color: (d, v) => that._.ui.style.waveform.color
					});
					L.waveformLayer.setBehavior(new wavesUI.behaviors.WaveformBehavior());
					L.waveformLayer.sort_data = sort_data; L.waveformLayer.visible_data = visible_data; 

					L.loopLayer = new wavesUI.helpers.SegmentLayer([], {}, {
						x: (d, v) => {
							if (v !== undefined) { 
								d.x = v; 
							}
							return d.x;
						}, 
						width: (d, v) => {
							if (v !== undefined) { 
								d.width = v; 
							}
							return d.width;
						},
						color: (d, v) => { 
							return that._.ui.style.loop.color; 
						}
					});
					L.loopLayer.sort_data = sort_data; L.loopLayer.visible_data = visible_data; 
					

					L.axis = new wavesUI.helpers.TimeAxisLayer({sort_data: sort_data, visible_data: visible_data, height: height/2});
					

					L.loopLayer.setTimeContext(that._.ui.timeContext);
					L.timeCursorLayer.setTimeContext(that._.ui.timeContext);
					L.beatGridLayer.setTimeContext(that._.ui.timeContext);
					L.waveformLayer.setTimeContext(that._.ui.timeContext);

					that._.ui.timeline.addLayer(L.axis, that._.ui.track, 'axis', true);
					that._.ui.timeline.addLayer(L.loopLayer, that._.ui.track, 'loop');
					that._.ui.timeline.addLayer(L.timeCursorLayer, that._.ui.track, 'cursor');
					that._.ui.timeline.addLayer(L.beatGridLayer, that._.ui.track, 'beat-grid');
					that._.ui.timeline.addLayer(L.waveformLayer, that._.ui.track, 'waveform');

					L.loopLayer.timeContext.lockedToParentInterval = true;
					L.timeCursorLayer.timeContext.lockedToParentInterval = true;
					L.beatGridLayer.timeContext.lockedToParentInterval = true;
					L.waveformLayer.timeContext.lockedToParentInterval = true;

					that._.ui.timeline.tracks.update();

					that._.ui.track.moveToTop(L.beatGridLayer);

					that._.ui.timeline.state = new wavesUI.states.SimpleEditionState(that._.ui.timeline);

				}, 
				init_controls: ($el) => {
					this._.ui.controls = {};
					this.create_input('play', 'play', 'button', { 
						onclick: (e) => {
							that.play(); 
							that._.ui.controls['play'].getElementsByTagName('button')[0].disabled = true; 
							that._.ui.controls['stop'].getElementsByTagName('button')[0].disabled = false;
						}, disabled: true });

					this.create_input('stop', 'stop', 'button', {
						onclick: (e) => {
							that.stop(); 
							that._.ui.controls['play'].getElementsByTagName('button')[0].disabled = false; 
							that._.ui.controls['stop'].getElementsByTagName('button')[0].disabled = true;
						}, disabled: true });

					this.create_input('drag-selection', 'drag selection', 'button',  {
						onclick: (e) => {
							that._.ui.timeline.state = new wavesUI.states.HorizontalSelectionState(that._.ui.timeline);
						}
					});

					this.create_input('loop', 'set loop', 'button', { onclick: (e) => {
						if (this._.ui.layers.beatGridLayer.selectedDatums.size == 2) {
							let selectedDatums = this._.ui.layers.beatGridLayer.selectedDatums;
							if (selectedDatums.size == 2) {
								let it = selectedDatums.values();
								let a = it.next().value;
								let b = it.next().value;
								if (b.time > a.time) 
									that.loop = {start: a.time, end: b.time } ;
								else 
									that.loop = {start: b.time, end: a.time } ;
							}
						} else 
							that.loop = undefined;
					}});

					this.create_input('tap-to-add', 'tap to add', 'button', { 
						onclick: (e) => that.add_beats([that._.audio.bufferCursor / (that._.audio.audioBuffer.sampleRate || 44100)])	});

					this.create_input('restart-audio', 'restart audio', 'button', { 
						onclick: (e) => that.restart_audio(), disabled: true });

					this.create_input('player-volume', 'player volume', 'range', { 
						oninput: (e) => {
							that._.audio.volumes.player = parseFloat(that._.ui.controls['player-volume'].getElementsByTagName('input')[0].value);
						}});

					this.create_input('metronome-volume', 'metronome volume', 'range', { 
						oninput: (e) => {
							that._.audio.volumes.metronome = parseFloat(that._.ui.controls['metronome-volume'].getElementsByTagName('input')[0].value);
						}});

					for (var k in that._.ui.controls) {
						$el.appendChild(that._.ui.controls[k]);
					}
				}
			}, 
			beatGrid: beatGrid
		};

		this.$el = uiParams.$el;
		this._.ui.init_ui(this.$el);

		// TODO!!!!!
		
	}

	create_input(name, title, type, params) {
		let $span = document.createElement('span');
		let $input = null;

		if (type == 'button') {
			$input = document.createElement('button');
			$input.innerHTML = title;
			$input.onclick = params.onclick;
		} else if (type == 'range') {
			$input = document.createElement('input');
			$input.type = 'range';
			$input.min = params.min || 0;
			$input.max = params.max || 1;
			$input.step = params.step || 0.1;
			$input.value = params.value || 1;
			$input.oninput = params.oninput;
		} else if (type == 'select') {
			// TODO
		}
		$input.disabled = params.disabled;
		$span.appendChild($input);
		this._.ui.controls[name] = $span;

		return $span;
	}

	refresh_beat_markers_table() {
		// TODO
	}

	restart_audio() {
		this._.audio.masterGain.disconnect();
		this._.audio.init_audio_graph();
		this._.audio.bufferCursor = 0;
		this._.ui.layers.timeCursorLayer.data[0].currentPosition = this._.audio.bufferCursor / (this._.audio.audioBuffer.sampleRate || 44100);
		this._.ui.track.updateLayers([this._.ui.layers.timeCursorLayer]);
		this.play();
		this._.ui.controls['play'].getElementsByTagName('button')[0].disabled = true;
		this._.ui.controls['stop'].getElementsByTagName('button')[0].disabled = false;
		this._.audio.masterGain.connect(_audioCtx.destination);
	}

	add_beats(times) {
		this._.beatGrid.add_beats(times);

		this._.ui.timeline.tracks.updateLayers([this._.ui.layers.beatGridLayer]);

		this.refresh_beat_markers_table();

		// this.emit("added-beats");
	}

	remove_beats(beats) {
		this._.beatGrid.remove_beats(beats);
	}

	remove_beats_in_interval(t0, t1) {

		if (t0==undefined) t0 = 0;

		if (t1==undefined) t1 = this._.ui.layers.beatGridLayer.data[this._.ui.layers.beatGridLayer.data.length-1].time;

		this._.beatGrid.remove_beats_in_interval(t0, t1);

		// this.emit("removed-beats");
	}

	play() {
		this._.audio.masterGain.connect(this._.audio.audioCtx.destination);
		// this.emit("play");
	}

	stop() {
		this._.audio.masterGain.disconnect();
		// this.emit("stop");
	}


	// GETTERS & SETTERS

	set currentTime(value) {
		if (value === undefined)
			return;
		this._.audio.bufferCursor = Math.round(value * (this._.audio.audioBuffer.sampleRate || 44100));
		this._.ui.layers.timeCursorLayer.data[0].currentPosition = value;
		this._.ui.track.updateLayers([this._.ui.layers.timeCursorLayer]);
	}

	get currentTime() {
		return this._.bufferCursor / (this._.audio.audioBuffer.sampleRate || 44100);
	}

	set loop(value) {
		if (value === undefined || value.start === undefined || value.end === undefined) {
			if (this._.ui.layers.loopLayer.data.length)
				this._.ui.layers.loopLayer.remove(this._.ui.layers.loopLayer.data[0]);
			this._.ui.track.updateLayers([this._.ui.layers.loopLayer]);
		} else if (value.start !== undefined && value.end !== undefined) {
			if (this._.ui.layers.loopLayer.data.length)
				this._.ui.layers.loopLayer.remove(this._.ui.layers.loopLayer.data[0]);
			this._.ui.layers.loopLayer.add({x: value.start, width: value.end - value.start});
			this._.ui.layers.loopLayer.data[0].x = value.start;
			this._.ui.layers.loopLayer.data[0].width = value.end - value.start;
			this._.ui.track.updateLayers([this._.ui.layers.loopLayer]);
		}
	}

	get loop() {
		if (this._.ui.layers.loopLayer.data.length) {
			return {
				start: this._.ui.layers.loopLayer.data[0].x, 
				end: this._.ui.layers.loopLayer.data[0].x + this._.ui.layers.loopLayer.data[0].width
			};
		} else 
			return undefined;
	}

	set beatGrid(beatTimes) {
		this._.beatGrid.clear();
		this._.beatGrid.add_beats(beatTimes);
		this.refresh_beat_markers_table();
		this._.ui.scroller.availableScrollRange = { 
			start: 0, 
			duration: Math.max(this._.ui.scroller.availableScrollRange.duration, this._.beatGrid.beatsArray[this._.beatGrid.beatsArray.length-1].time) 
		};
		this._.ui.track.updateLayers([this._.ui.layers.beatGridLayer]);
	}

	get beatGrid() {
		return this._.beatGrid;
	}

	set audioBuffer(value) {
		// TODO
		this._.audio.bufferCursor = 0;
		this._.audio.init_audio_graph();
		this._.audio.audioBuffer = value;
		let datum = {
			data: value.getChannelData(0),
			bufferStart: 0, 
			bufferEnd: value.length, 
			x: 0 , 
			width: value.duration, 
			text: "W"+0
		};
		this._.ui.layers.waveformLayer.set([datum]);
		let shape = this._.ui.layers.waveformLayer.getShapeFromDatum(datum);
		shape.params.displayHeader = false;
		shape.params.displayBody = false;
		shape.params.displayLabel = false;
		shape.params.displayHandlers = false;
		this._.ui.scroller.availableScrollRange = { start: 0, duration: Math.max(this._.ui.scroller.availableScrollRange.duration, value.duration) };
		this._.ui.track.updateLayers([this._.ui.layers.waveformLayer]);
		this._.ui.controls['play'].getElementsByTagName('button')[0].disabled = false;
		this._.ui.controls['stop'].getElementsByTagName('button')[0].disabled = true;
		this._.ui.controls['restart-audio'].getElementsByTagName('button')[0].disabled = false;
	}

	get audioBuffer() {
		return this._.audio.audioBuffer;
	}

	set volumes(value) {
		if (value.metronome !== undefined) {
			this._.audio.volumes.metronome = value.metronome;
		}
		if (value.player !== undefined) {
			this._.audio.volumes.player = value.player;
		}
		if (value.master !== undefined) {
			this._.audio.volumes.master = value.master;
		}
	}

	get volumes() {
		return this._.audio.volumes;
	}



}


// module.export = BeatGridEditor;