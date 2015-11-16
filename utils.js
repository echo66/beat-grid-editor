function download_json(url, success, error) {
	var request = new XMLHttpRequest();
	request.open('GET', url, true);

	request.onload = function() {
		if (request.status >= 200 && request.status < 400) {
			var data = JSON.parse(request.responseText);
			success(data);
		} else {
			error();
		}
	};

	request.onerror = error;

	request.send();
}

// params: {beatsSrc1: URL, duration: Number | beats: Array, duration: Number | bpm: Number, firstBeat: Number, duration: Number}
function load_beats(params, callback) {
	var P = params;
	if (P.duration) {
		if (P.beatsSrc1)
			download_json(P.beatsSrc1, function(beats) {
				callback(createBeatsArray1(beats, P.duration));
			});
		else if (P.beats)
			callback(createBeatsArray1(P.beats, P.duration));
		else if (P.bpm!=undefined && P.firstBeat!=undefined)
			callback(createBeatsArray2(P.bpm, P.firstBeat, P.duration));
		else
		throw "Invalid parameters";
	} else
		throw "Invalid parameters";

	function createBeatsArray1(beats, duration) {
		var _beats = new Array(beats.length);
		B = beats;
		var star, end, beatPeriod, beatBPM;

		for (var i=0; i < B.length-1 && B[i] < duration; i++) {
			start = B[i];
			end   = B[i+1];
			beatPeriod = end - start;
			beatBPM = 60 / beatPeriod;
			_beats[i] = [start, end, beatBPM];
		}

		start = B[B.length-1];
		end = start + beatPeriod;
		if (end <= duration)
			_beats[B.length-1] = [start, end, beatBPM];

		return _beats;
	}

	function createBeatsArray2(bpm, firstBeat, duration) {
		var beatPeriod = 60/bpm;

		var beats = [];

		for (var i=firstBeat || 0; i>0; i-=beatPeriod) {}

		for (var t0=i; t0<duration; t0+=beatPeriod)
			var t1 = t0 + beatPeriod;
		if (t1<=duration)
			beat[beats.length] = [t0, t1, bpm];

		return beats;
	}
}

function parse_beats_json(obj) {
	var arr = obj.beat[0].data;
	var beats = new Array(arr.length);

	for (var i=0; i < beats.length; i++) {
		beats[i] = arr[i].time.value;
		// beats[i] = [arr[i].time.value, (arr[i+1])?arr[i+1].time.value:undefined, (arr[i].label)?parseFloat(arr[i].label.value.replace(',','.').replace(' bpm', '')):undefined];
	}

	return beats;
}

function load_sample(audioCtx, url, callback) {
	var request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.responseType = 'arraybuffer';
		request.onload = function() {
		audioCtx.decodeAudioData(request.response, function(decodedData) {
			callback(decodedData);
		});
	};
	request.send();
};

function load_audio_data(audioCtx, audioBufferURL, beatGridURL, callback) {
	load_sample(audioCtx, audioBufferURL, function(audioBuffer) {
		download_json(beatGridURL, function(beatsJSON) {
			var beats = parse_beats_json(beatsJSON);
			// callback(audioBuffer, beats);
			load_beats({ beats: beats, duration: audioBuffer.duration }, function(beatsData){
				callback(audioBuffer, beatsData);
			});
		})
	});
}