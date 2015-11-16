function BeatGridInteractions(proxyState, beatGridLayer, timeCursorLayer, beatGridEditor) {
	
	var _state = undefined;
	var _currentTarget = null;
	var that = this;


	function _resetBrush(track) {
		var $brush = track.$brush;
		// reset brush element
		$brush.setAttributeNS(null, 'transform', 'translate(0, 0)');
		$brush.setAttributeNS(null, 'width', 0);
		$brush.setAttributeNS(null, 'height', 0);
	}

	function _addBrush(track) {
		if (track.$brush) { 
			return; 
		}

		var brush = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
		brush.style.fill = '#686868';
		brush.style.opacity = 0.2;

		track.$interactions.appendChild(brush);
		track.$brush = brush;
	}

	function _removeBrush(track) {
		if (track.$brush === null) { return; }

		_resetBrush(track);
		track.$interactions.removeChild(track.$brush);
		delete track.$brush;
	}
	

	function _updateBrush(e, track) {
		var $brush = track.$brush;
		var translate = "translate(" + e.area.left + "," + e.area.top + ")";

		$brush.setAttributeNS(null, 'transform', translate);
		$brush.setAttributeNS(null, 'width', e.area.width);
		$brush.setAttributeNS(null, 'height', e.area.height);
	}

	proxyState.on('keydown', function(e) {
		if (e.keyCode == 46) {
			var selectedItems = beatGridLayer.selectedItems
			var data = beatGridLayer.data;
			for (var i in selectedItems) {
				var item = selectedItems[i];
				var datum = beatGridLayer.getDatumFromItem(item);
				var index = data.findIndex(function(a) { return a == datum; });
				data.splice(index, 1);
			}

			beatGridLayer.data = [];
			proxyState.timeline.tracks.render(beatGridLayer);
			proxyState.timeline.tracks.update(beatGridLayer);

			beatGridLayer.data = data;
			proxyState.timeline.tracks.render(beatGridLayer);
			proxyState.timeline.tracks.update(beatGridLayer);
		} else if (e.keyCode == 65 && e.ctrlKey) {
			beatGridLayer.select(beatGridLayer.items);
			console.log("all");
		}
	});


	proxyState.on('dblclick', function(time, e) {
		if (!e.originalEvent.shiftKey && !e.originalEvent.ctrlKey) {
			beatGridEditor.add_beats([time]);
		}
	});

	proxyState.on('click', function(time, e) {
		// if (!e.originalEvent.shiftKey) {
		// 	beatGridLayer.unselect();
		// }
	});

	proxyState.on('mousewheel', function(time, e) {
		console.log([e.originalEvent.wheelDelta, e.originalEvent.wheelDeltaX, e.originalEvent.wheelDeltaY]);

		// TODO
	});

	proxyState.on('mousedown', function(time, e) {

		if (e.originalEvent.ctrlKey) {
			beatGridEditor.set_current_time(time);
			return;
		}

		// VERIFICA SE TOCOU EM ALGUMA BATIDA.
		// SE TOCOU, A INTERAÇÃO É DE SELECÇÃO.

		// INICIA A POSSIBILIDADE DE DRAG.



		// keep target consistent with mouse down
		this.currentTarget = e.target;
		if (beatGridLayer.hasElement(this.currentTarget)) {
			// TOCOU NUMA BATIDA
			console.log("Tocou numa batida.");
			// SELECCIONA ESSA BATIDA
			if (!e.originalEvent.shiftKey) {
				beatGridLayer.unselect();
			}
			var item = beatGridLayer.getItemFromDOMElement(this.currentTarget);
			if (item === null) { 
				return; 
			}
			requestAnimationFrame(function() { 
				beatGridLayer.select(item); 
			});
			_state = "beats";
		} else {
			// TOCOU NO VAZIO
			console.log("Tocou no vazio.");

			if (!e.originalEvent.shiftKey) {
				beatGridLayer.unselect();
			}

			
			this.currentTrack = proxyState.timeline.getTrackFromDOMElement(e.target);
			if (!this.currentTrack) { 
				return; 
			}
			_addBrush(this.currentTrack);

			this.layerSelectedItemsMap = new Map();
			this.layerSelectedItemsMap.set(beatGridLayer, beatGridLayer.selectedItems.slice(0));

			_state = "empty";
		}
	});

	proxyState.on('mousemove', function(time, e) {
		if (_state == "beats") {

			var items = beatGridLayer.selectedItems;
			beatGridLayer.edit(items, e.dx, e.dy, this.currentTarget);
			requestAnimationFrame(function() { 
				beatGridLayer.update(items); 
			});

		} else {

			_updateBrush(e, this.currentTrack);

			var currentSelection = beatGridLayer.selectedItems;
			var currentItems = beatGridLayer.getItemsInArea(e.area);

			// if is not pressed
			if (!e.originalEvent.shiftKey) {
				beatGridLayer.unselect(currentSelection);
				beatGridLayer.select(currentItems);
			} else {
				var toSelect = [];
				var toUnselect = [];
				// use the selection from the previous drag
				var previousSelection = this.layerSelectedItemsMap.get(beatGridLayer);
				// toUnselect = toUnselect.concat(previousSelectedItems);

				currentItems.forEach(function(item) {
					if (previousSelection.indexOf(item) === -1) {
						toSelect.push(item);
					} else {
						toUnselect.push(item);
					}
				});

				currentSelection.forEach(function(item) {
					if ( currentItems.indexOf(item) === -1 && previousSelection.indexOf(item) === -1 ) {
						toUnselect.push(item);
					}
				});

				beatGridLayer.unselect(toUnselect);
				beatGridLayer.select(toSelect);
			}
		}
	});

	proxyState.on('mouseup', function(time, e) { 

		// TERMINA A POSSIBILIDADE DE DRAG.
		// TERMINA O DRAG DE BEATS.
		// TERMINA O DRAG DA SELECÇÃO

		switch (_state) {
			case "beats": break;
			case "empty": 
				_removeBrush(this.currentTrack);
				break;
		}

		_state = undefined;
	});


	this.destroy = function() {
		// TODO
	}
}