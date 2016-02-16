'use strict';

class BeatGridEditorAudioController {

	constructor(bufferSize) {

		this.masterGain = _audioCtx.createGain();
		this.metronomeGain = _audioCtx.createGain();
		this.metronomeCtrlGain = _audioCtx.createGain();
		this.metronomeCtrlGain.gain.value = 1;
		this.playerGain = _audioCtx.createGain();

		this.metronomeOsc = _audioCtx.createOscillator();
		this.metronomeOsc.type = 'sine';
		this.metronomeOsc.frequency.value = 600;
		this.metronomeOsc.start();
		this.metronomeCtrl = _audioCtx.createScriptProcessor(bufferSize, 2);
		this.metronomeCtrl.onaudioprocess = function(e) {
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

		this.playerNode = _audioCtx.createScriptProcessor(BUFFER_SIZE, 2);
		this.playerNode.onaudioprocess = function(e) {

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

		this.metronomeOsc.connect(metronomeCtrl);
		
		this.metronomeCtrl.connect(playerGain);
		this.playerNode.connect(metronomeGain);

		this.playerGain.connect(masterGain);
		this.metronomeGain.connect(masterGain);
	}


	set volume(pair) {
		switch (pair.type) {
			case 'master': 
							this.masterGain.gain.value
							break;
			case 'player': 
							
							break;
			case 'metronome': 
							
							break;
		}
	}

	get volume() {

	}
	
}

module.exports = BeatGridAudio;