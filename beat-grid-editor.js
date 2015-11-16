function BeatGridEditor(domEl, height, duration, audioCtx) {



	/*
	 FEATURES PLANEADAS:
	 	[ ] Adição e remoção de beat markers individuais ou de grupos de beat markers.
	 	[ ] Drag de um, ou mais, beat markers.
	 	[ ] Emissão de eventos.
	 	[ ] Hipótese de escolher beat grids.
	 	[ ] Waveform e beat grid estão sobrepostas.
	 	[ ] Uso de um metrónomo e o controlo do ganho para o metrónomo.
	 	[ ] Permitir a inserção de batidas através do bater do dedo.
	 */

	var _audioBuffer;

	var _idCounter = 0;

	var _cursor1 = 0;

	var _audioCtx = audioCtx;

	var _loopStart, _loopEnd;

	var BUFFER_SIZE = 2048;
	var SAMPLE_RATE = 44100;
	var _showBeatMarkersText = false;

	// WAVESJS UI parameters & objects
	var _mainContainerDOMEl = domEl;
	var _trackDOMEl;
	var _controlsDOMEl = [];
	var _beatMarkersTableDOMEl;
	var _timeline, _track, _beatGridLayer, _waveformLayer, _timeCursorLayer, _timeContext;
	var BEAT_GRID_COLOR = 'orange';
	var TIME_CURSOR_COLOR = 'red';
	var WAVEFORM_COLOR = 'steelblue';



	var playerGain, playerNode, metronomeCtrl, metronomeOsc, metronomeCtrlGain, metronomeGain, masterGain;
	var that = this;

	var _bgi;

	_initAudioGraph();

	_createUI();

	this.timeline = _timeline;

	// _timeline.state = new wavesUI.states.CenteredZoomState(_timeline);



	function refresh_beat_markers_table() {
		_beatMarkersTableDOMEl.innerHTML = '';
		return;
		for (var i in _beatGridLayer.data) {
			var b = _beatGridLayer.data[i];
			var el = document.createElement('p');
			el.innerHTML = b.t0;
			_beatMarkersTableDOMEl.appendChild(el);
		}
	}

	function distance_to_closest_beat(t) {
		var idx = find_index(_beatGridLayer.data, {t0: _cursor1/SAMPLE_RATE}, function(a,b) { return a.t0 - b.t0; });
		var t;
		if (idx.length == 1) {
			idx = idx[0]; 
			t = _beatGridLayer.data[idx].t0 * SAMPLE_RATE;
			
		} else {
			var pidx = idx[0];
			var nidx = idx[1];
			if (nidx==undefined) 
				t = _beatGridLayer.data[_beatGridLayer.data.length].t0 * SAMPLE_RATE;
			else {
				var dp = Math.abs(_beatGridLayer.data[pidx].t0*SAMPLE_RATE-_cursor1);
				var dn = Math.abs(_beatGridLayer.data[nidx].t0*SAMPLE_RATE-_cursor1);
				if (dp > dn) 
					t = _beatGridLayer.data[nidx].t0 * SAMPLE_RATE;
				else 
					t = _beatGridLayer.data[pidx].t0 * SAMPLE_RATE;
			}
		}
		return Math.abs(_cursor1-t);
	}


	function _initAudioGraph() {

		masterGain = _audioCtx.createGain();
		metronomeGain = _audioCtx.createGain();
		metronomeCtrlGain = _audioCtx.createGain();
		metronomeCtrlGain.gain.value = 1;
		playerGain = _audioCtx.createGain();


		metronomeOsc = _audioCtx.createOscillator();
		metronomeOsc.type = 'sine';
		metronomeOsc.frequency.value = 600;
		metronomeOsc.start();
		metronomeCtrl = _audioCtx.createScriptProcessor(BUFFER_SIZE, 2);
		metronomeCtrl.onaudioprocess = function(e) {
			var ol = e.outputBuffer.getChannelData(0);
			var or = e.outputBuffer.getChannelData(1);
			var il = e.inputBuffer.getChannelData(0);

			if (_beatGridLayer.data.length > 0) {
				for (var i=0; i<BUFFER_SIZE; i++) {
					var idx = find_index(_beatGridLayer.data, {t0: (_cursor1+i)/SAMPLE_RATE}, function(a,b) { return a.t0 - b.t0; });
					var t;
					if (idx.length == 1) {
						idx = idx[0]; 
						t = _beatGridLayer.data[idx].t0 * SAMPLE_RATE;
						
					} else {
						var pidx = idx[0];
						var nidx = idx[1];
						if (nidx==undefined) 
							t = _beatGridLayer.data[_beatGridLayer.data.length].t0 * SAMPLE_RATE;
						else {
							var dp = Math.abs(_beatGridLayer.data[pidx].t0*SAMPLE_RATE-_cursor1+i);
							var dn = Math.abs(_beatGridLayer.data[nidx].t0*SAMPLE_RATE-_cursor1+i);
							if (dp > dn) 
								t = _beatGridLayer.data[nidx].t0 * SAMPLE_RATE;
							else 
								t = _beatGridLayer.data[pidx].t0 * SAMPLE_RATE;
						}
					}
					// var v = (Math.abs(_cursor1+i-t) && _cursor1+i-t <= BUFFER_SIZE)? Math.abs(_cursor1+i-t) / (BUFFER_SIZE) : 0;
					var v = ( Math.abs(_cursor1+i-t) <= BUFFER_SIZE/4)? 1 : 0;
					or[i] = ol[i] = il[i] * v;
				}
			} else {
				ol.fill(0);
				or.fill(0);
			}

		}

		playerNode = _audioCtx.createScriptProcessor(BUFFER_SIZE, 2);
		playerNode.onaudioprocess = function(e) {

			var il = e.inputBuffer.getChannelData(0);
			var ir = e.inputBuffer.getChannelData(1);

			var ol = e.outputBuffer.getChannelData(0);
			var or = e.outputBuffer.getChannelData(1);

			if (_audioBuffer) {
				var iil = _audioBuffer.getChannelData(0);
				var iir = _audioBuffer.getChannelData(1);
				var p = 0;

				for (var i=0; i<BUFFER_SIZE; i++) {
					p = _cursor1++;
					ol[i] = iil[p] + il[i];
					or[i] = iir[p] + ir[i];
					if (_loopEnd != undefined && _cursor1 > _loopEnd) {
						_cursor1 = _loopStart;
					}
				}

				// _cursor1 += BUFFER_SIZE;
				_timeCursorLayer.data[0].currentPosition = _cursor1 / SAMPLE_RATE;
				_timeline.tracks.update(_timeCursorLayer);
			}

		}

		metronomeOsc.connect(metronomeCtrl);
		
		metronomeCtrl.connect(playerGain);
		playerNode.connect(metronomeGain);

		playerGain.connect(masterGain);
		metronomeGain.connect(masterGain);
		
	}

	this.restart_audio = function() {
		masterGain.disconnect();
		_initAudioGraph();
		_cursor1 = 0;
		_timeCursorLayer.data[0].currentPosition = _cursor1 / SAMPLE_RATE;
		_timeline.tracks.update(_timeCursorLayer);
		that.play();
		_controlsDOMEl['play'].disabled = true;
		_controlsDOMEl['stop'].disabled = false;
		masterGain.connect(_audioCtx.destination);
	}

	function initWaveformUI(array) {
		_waveformLayer = new wavesUI.core.Layer('entity', [], {
			height: height,
			yDomain: [-1, 1]
		});
		_waveformLayer.setTimeContext(_timeContext);
		_waveformLayer.configureShape(wavesUI.shapes.Waveform, {
			y: function(d) { return d; },
		}, {
			color: WAVEFORM_COLOR
		});
	}

	this.set_loop = function(start, end) {
		_loopStart = Math.round(start * SAMPLE_RATE);
		_loopEnd = Math.round(end * SAMPLE_RATE);
	}

	function _createUI() {
		/*
		 * <> Waveform (WAVESJS)
		 * <> Beat grid (WAVESJS)
		 * <> Time cursor (WAVESJS)
		 * <> Play and Stop buttons.
		 * <> "Switch" to allow the timeline context to follow the time cursor.
		 * <> "Switches" to change between the following modes: 
		 *		(1) drag the _timeline, 
		 *		(2) add beat maker, 
		 *		(3) remove beat marker,
		 *		(4) drag beat marker,
		 */

		_mainContainerDOMEl.innerHTML = '';
		_trackDOMEl = document.createElement('div');
		_mainContainerDOMEl.appendChild(_trackDOMEl);
		var width = _trackDOMEl.getBoundingClientRect().width;
		var height = 60;
		var duration = 20;
		var pixelsPerSecond = width / duration;

		_timeline = new wavesUI.core.Timeline(pixelsPerSecond, width);
		_timeContext = new wavesUI.core.LayerTimeContext(_timeline.timeContext);

		_track = new wavesUI.core.Track(_trackDOMEl, height);
		_timeline.add(_track);

		_beatGridLayer = new wavesUI.core.Layer('collection', [], {
			height: height
		});

		_beatGridLayer.on('edit', function(shape, datum) {
			refresh_beat_markers_table()
		});
		
		_beatGridLayer.setTimeContext(_timeContext);
		_beatGridLayer.configureShape(wavesUI.shapes.AnnotatedMarker, {
			x: function(d, v) {
				if (v !== undefined) { d.t0 = v; }
				return d.t0;
			},
			text: function(d, v) {
				return (_showBeatMarkersText)? d.t0 : '';
			},
			color: function() {
				return BEAT_GRID_COLOR;
			}
		});

		_beatGridLayer.setBehavior(new wavesUI.behaviors.MarkerBehavior());


		_timeCursorLayer = new wavesUI.core.Layer('entity', { currentPosition: 0 }, {
			height: height
		});
		_timeCursorLayer.setTimeContext(_timeContext);
		_timeCursorLayer.configureShape(wavesUI.shapes.Cursor, {
			x: function(d) { return d.currentPosition; }
		}, {
			color: TIME_CURSOR_COLOR
		});

		_waveformLayer = new wavesUI.core.Layer('entity', [], {
			height: height,
			yDomain: [-1, 1]
		});
		_waveformLayer.setTimeContext(_timeContext);
		_waveformLayer.configureShape(wavesUI.shapes.Waveform, {
			y: function(d) { return d; },
		}, {
			color: WAVEFORM_COLOR,
			opacity: 0.8
		});

		_track.add(_timeCursorLayer);
		_track.add(_beatGridLayer);
		_track.add(_waveformLayer);
		_track.render();
		_track.update();

		_timeline.tracks.render();
		_timeline.tracks.update();

		_controlsDOMEl['play'] = document.createElement('button');
		_controlsDOMEl['play'].innerHTML = 'play';
		_controlsDOMEl['play'].onclick = function(e) {
			that.play();
			_controlsDOMEl['play'].disabled = true;
			_controlsDOMEl['stop'].disabled = false;
		}

		_controlsDOMEl['stop'] = document.createElement('button');
		_controlsDOMEl['stop'].innerHTML = 'stop';
		_controlsDOMEl['stop'].onclick = function(e) {
			that.stop();
			_controlsDOMEl['play'].disabled = false;
			_controlsDOMEl['stop'].disabled = true;
		}

		_controlsDOMEl['edit'] = document.createElement('button');
		_controlsDOMEl['edit'].innerHTML = 'edit';
		_controlsDOMEl['edit'].onclick = function(e) {
			that.change_interaction_mode('edit');
		}

		_controlsDOMEl['drag-view'] = document.createElement('button');
		_controlsDOMEl['drag-view'].innerHTML = 'drag view';
		_controlsDOMEl['drag-view'].onclick = function(e) {
			that.change_interaction_mode('drag-view');
		}

		_controlsDOMEl['toggle-beat-markers-text'] = document.createElement('button');
		_controlsDOMEl['toggle-beat-markers-text'].innerHTML = 'toggle beat markers text';
		_controlsDOMEl['toggle-beat-markers-text'].onclick = function(e) {
			_showBeatMarkersText = !_showBeatMarkersText;
			_timeline.tracks.update(_beatGridLayer);

		}

		_controlsDOMEl['tap-to-add'] = document.createElement('button');
		_controlsDOMEl['tap-to-add'].innerHTML = 'tap to add';
		_controlsDOMEl['tap-to-add'].onclick = function(e) {
			that.add_beats([_cursor1/SAMPLE_RATE]);
		}

		_controlsDOMEl['restart-audio'] = document.createElement('button');
		_controlsDOMEl['restart-audio'].innerHTML = 'restart audio';
		_controlsDOMEl['restart-audio'].onclick = function(e) {
			that.restart_audio();
		}
		_controlsDOMEl['restart-audio'].disabled = true;

		_controlsDOMEl['player-volume'] = document.createElement('input');
		_controlsDOMEl['player-volume'].type = 'range';
		_controlsDOMEl['player-volume'].min = 0;
		_controlsDOMEl['player-volume'].max = 1;
		_controlsDOMEl['player-volume'].step = 0.1;
		_controlsDOMEl['player-volume'].value = 1;
		_controlsDOMEl['player-volume'].oninput = function(e) {
			that.set_volume('player', _controlsDOMEl['player-volume'].value);
		}

		_controlsDOMEl['metronome-volume'] = document.createElement('input');
		_controlsDOMEl['metronome-volume'].type = 'range';
		_controlsDOMEl['metronome-volume'].min = 0;
		_controlsDOMEl['metronome-volume'].max = 1;
		_controlsDOMEl['metronome-volume'].step = 0.1;
		_controlsDOMEl['metronome-volume'].value = 1;
		_controlsDOMEl['metronome-volume'].oninput = function(e) {
			that.set_volume('metronome', _controlsDOMEl['metronome-volume'].value);
		}



		_controlsDOMEl['play'].disabled = true;
		_controlsDOMEl['stop'].disabled = true;

		for (var k in _controlsDOMEl) {
			_mainContainerDOMEl.appendChild(_controlsDOMEl[k]);
		}


		this.timeline = _timeline;
		this.cursorLayer = _timeCursorLayer;


		_beatMarkersTableDOMEl = document.createElement('div');
		_mainContainerDOMEl.appendChild(_beatMarkersTableDOMEl);
	}


	this.set_beat_grid = function(beatsData) {
		_beatGridLayer.data = new Array(beatsData.length);
		for (var i in beatsData) {
			_beatGridLayer.data[i] = {t0: beatsData[i], _id: _idCounter++};
		}
		_track.render();
		_track.update();
		refresh_beat_markers_table();
	}

	this.load_audio_buffer = function(inputArrayL, inputArrayR, length, sampleRate) {
		metronomeCtrlGain.gain.cancelScheduledValues(0);
		metronomeCtrlGain.gain.value = 0;
		_audioBuffer = _audioCtx.createBuffer(2, length, sampleRate);
		_audioBuffer.getChannelData(0).set(inputArrayL, 0);
		_audioBuffer.getChannelData(1).set(inputArrayR, 0);
		_waveformLayer.data[0] = inputArrayL;
		_track.render();
		_track.update();
		_controlsDOMEl['play'].disabled = false;
		_controlsDOMEl['restart-audio'].disabled = false;
		_emit("loaded-audio-buffer", { audioBuffer: _audioBuffer });
	}

	this.add_beats = function(newBeats) {
		var data = _beatGridLayer.data;
		_beatGridLayer.data = [];

		_timeline.tracks.render(_beatGridLayer);
		_timeline.tracks.update(_beatGridLayer);

		for (var i=0; i<newBeats.length; i++) {
			data[data.length] = {t0: newBeats[i]};
		}
		data.sort(function(a,b) { return a.t0 - b.t0; });

		_beatGridLayer.data = data;
		_timeline.tracks.render(_beatGridLayer);
		_timeline.tracks.update(_beatGridLayer);

		refresh_beat_markers_table();

		_emit("added-beats", {});
	}

	this.remove_beats = function(t0, t1) {
		// the naive way

		if (!_beatGridLayer.data.length)
			return;

		if (t0==undefined)
			t0 = 0;

		if (t1==undefined)
			t1 = _beatGridLayer.data[_beatGridLayer.data.length-1].t0;

		var data = _beatGridLayer.data;
		_beatGridLayer.data = [];

		_timeline.tracks.render(_beatGridLayer);
		_timeline.tracks.update(_beatGridLayer);

		for (var i=0; i<data.length; i++) {
			if (data[i].t0 < t0 || data[i].t0 > t1) {
				_beatGridLayer.data[_beatGridLayer.data.length] = data[i];
			}
		}

		_timeline.tracks.render(_beatGridLayer);
		_timeline.tracks.update(_beatGridLayer);

		refresh_beat_markers_table();

	}

	this.set_current_time = function(newTime) {
		_cursor1 = Math.round(newTime * SAMPLE_RATE);
		_timeCursorLayer.data[0].currentPosition = newTime;
		_timeline.tracks.update(_timeCursorLayer);
	}

	this.get_current_time = function() {
		return _cursor1 / SAMPLE_RATE;
	}

	this.play = function() {
		masterGain.connect(_audioCtx.destination);
	}

	this.stop = function() {
		masterGain.disconnect();
	}

	this.destroy = function() {
		// TODO
	}

	this.set_volume = function(element, value) {
		switch (element) {
			case 'metronome': metronomeGain.gain.value = value; break;
			case 'player': playerGain.gain.value = value; break;
			case 'master': masterGain.gain.value = value; break;
		}

	}

	this.get_volume = function(element) {
		switch (element) {
			case 'metronome': return metronomeGain.gain.value;
			case 'player': return playerGain.gain.value;
			case 'master': return masterGain.gain.value;
		}
	}


	this.change_interaction_mode = function(mode) {
		switch (mode) {
			case 'drag-view': 
				_timeline.state = new wavesUI.states.CenteredZoomState(_timeline);
				break;
			case 'edit': 
				_timeline.state = new wavesUI.states.ProxyState(_timeline);
				_bgi = new BeatGridInteractions(_timeline.state, _beatGridLayer, _timeCursorLayer, this);
				break;
			case 'select': 
				_timeline.state = new wavesUI.states.SelectionState(_timeline);
				break;
			case 'move-time-cursor':
				_timeline.state = new wavesUI.states.ProxyState(_timeline);
				_timeline.state.on('click', function(time, e) {
					that.set_current_time(time);
				});
				break;
		}
	}

	this.set_visible_interval = function(offset, duration) {
		_timeline.timeContext.offset = -offset;
		_timeline.timeContext._children.forEach(function(timeCtx, i) {
			timeCtx.duration = _timeline.timeContext.offset + duration;
		});
		_timeline.tracks.update();
	}







	/***************************************************************/
	/******************* BINARY SEARCH FUNCTIONS *******************/
	/***************************************************************/
	function find_index(values, target, compareFn) {
		if (values.length == 0 || compareFn(target, values[0]) < 0) { 
			return [0]; 
		}
		if (compareFn(target, values[values.length-1]) > 0 ) {
			return [values.length-1];
		}
		return modified_binary_search(values, 0, values.length - 1, target, compareFn);
	}

	function modified_binary_search(values, start, end, target, compareFn) {
		// if the target is bigger than the last of the provided values.
		if (start > end) { return [end]; } 

		var middle = Math.floor((start + end) / 2);
		var middleValue = values[middle];

		if (compareFn(middleValue, target) < 0 && values[middle+1] && compareFn(values[middle+1], target) > 0)
			// if the target is in between the two halfs.
			return [middle, middle+1];
		else if (compareFn(middleValue, target) > 0)
			return modified_binary_search(values, start, middle-1, target, compareFn); 
		else if (compareFn(middleValue, target) < 0)
			return modified_binary_search(values, middle+1, end, target, compareFn); 
		else 
			return [middle]; //found!
	}




	/***************************************************************/
	/*********************** EVENTS HANDLING ***********************/
	/***************************************************************/
	var _callbacks =  {
		"loaded-beat-grid": {},
		"loaded-audio-buffer": {},
		"added-beats": {},
		"removed-beats": {},
	};
	var _idCounter = 0;

	var eventsToEmit = [];
	var eventsToEmitPointer = 0;

	function _push_event_to_emit(type, data) {
		eventsToEmit[eventsToEmitPointer++] = { type: type, data: data };
	}

	function _emit_all_events() {
		var m = eventsToEmitPointer;
		for (var i=0; i<m; i++, eventsToEmitPointer--) 
			_emit(eventsToEmit[i].type, eventsToEmit[i].data);
	}

	var _emit = function(evenType, data) {
		for (var ci in _callbacks[evenType]) 
			_callbacks[evenType][ci](data);
	}

	this.add_event_listener = function(observerID, eventType, callback) {

		// if (!eventType || _callbacks[eventType]==undefined) 
		// 	throw "Unsupported event type";

		if (observerID!=undefined && _callbacks[eventType][observerID]!=undefined) 
			throw "Illegal modification of callback";

		var __id = (observerID==undefined)? _id + "-associate-" + (_idCounter++) : observerID;
		_callbacks[eventType][__id] = callback;
		return __id;
	}

	this.remove_event_listener = function(observerID, eventType) {

		// if (!eventType || _callbacks[eventType]==undefined) 
		// 	throw "Unsupported event type";

		delete _callbacks[eventType][observerID];
	}
}