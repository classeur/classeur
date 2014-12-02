angular.module('classeur.services.scrollSync', [
	'classeur.services.layout',
	'classeur.services.cleditor'
])
	.factory('scrollSync', function(layout, cleditor) {
		var scrollSync = {};

		var scrollSyncOffset = 120;

		// Credit: Underscore.js
		function throttle(func, wait) {
			var context, args, result;
			var timeout = null;
			var previous = 0;
			var later = function() {
				previous = Date.now();
				timeout = null;
				result = func.apply(context, args);
				if(!timeout) context = args = null;
			};
			return function() {
				var now = Date.now();
				var remaining = wait - (now - previous);
				context = this;
				args = arguments;
				if(remaining <= 0 || remaining > wait) {
					clearTimeout(timeout);
					timeout = null;
					previous = now;
					result = func.apply(context, args);
					if(!timeout) context = args = null;
				} else if(!timeout) {
					timeout = setTimeout(later, remaining);
				}
				return result;
			};
		}

		var timeoutId;
		var currentEndCb;

		function animate(elt, startValue, endValue, stepCb, endCb) {
			if(currentEndCb) {
				clearTimeout(timeoutId);
				currentEndCb();
			}
			currentEndCb = endCb;
			var diff = endValue - startValue;
			var startTime = Date.now();

			function tick() {
				var currentTime = Date.now();
				var progress = (currentTime - startTime) / 240;
				if(progress < 1) {
					var scrollTop = startValue + diff * Math.cos((1 - progress) * Math.PI / 2);
					elt.scrollTop = scrollTop;
					stepCb(scrollTop);
					timeoutId = setTimeout(tick, 1);
				}
				else {
					currentEndCb = undefined;
					elt.scrollTop = endValue;
					setTimeout(endCb, 100);
				}
			}

			tick();
		}

		function getDestScrollTop(srcScrollTop, srcSectionList, destSectionList) {
			srcScrollTop += scrollSyncOffset;

			// Find the section corresponding to the offset
			var sectionIndex;
			srcSectionList.some(function(section, index) {
				if(srcScrollTop < section.endOffset) {
					sectionIndex = index;
					return true;
				}
			});
			if(sectionIndex === undefined) {
				// Something bad happened
				return;
			}
			var srcSection = srcSectionList[sectionIndex];
			var posInSection = (srcScrollTop - srcSection.startOffset) / (srcSection.height || 1);
			var destSection = destSectionList[sectionIndex];
			var result = destSection.startOffset + destSection.height * posInSection;

			return result - scrollSyncOffset;
		}

		var editorElt, previewElt;

		scrollSync.setEditorElt = function(elt) {
			editorElt = elt;

			editorElt.addEventListener('scroll', function() {
				if(!isEditorMoving) {
					isScrollEditor = true;
					isScrollPreview = false;
					doScrollSync();
				}
			});
		};

		scrollSync.setPreviewElt = function(elt) {
			previewElt = elt;

			previewElt.addEventListener('scroll', function() {
				if(!isPreviewMoving && !scrollAdjust) {
					isScrollPreview = true;
					isScrollEditor = false;
					doScrollSync();
				}
				scrollAdjust = false;
			});
		};

		var mdSectionList = [];
		var htmlSectionList = [];
		var lastEditorScrollTop;
		var lastPreviewScrollTop;
		var buildSections = window.ced.Utils.debounce(function() {

			mdSectionList = [];
			var mdSectionOffset;
			var scrollHeight;
			Array.prototype.forEach.call(editorElt.querySelectorAll('.classeur-editor-section'), function(delimiterElt) {
				if(mdSectionOffset === undefined) {
					// Force start to 0 for the first section
					mdSectionOffset = 0;
					return;
				}
				delimiterElt = delimiterElt.firstChild;
				// Consider div scroll position
				var newSectionOffset = delimiterElt.offsetTop;
				mdSectionList.push({
					startOffset: mdSectionOffset,
					endOffset: newSectionOffset,
					height: newSectionOffset - mdSectionOffset
				});
				mdSectionOffset = newSectionOffset;
			});
			// Last section
			scrollHeight = editorElt.scrollHeight;
			mdSectionList.push({
				startOffset: mdSectionOffset,
				endOffset: scrollHeight,
				height: scrollHeight - mdSectionOffset
			});

			// Find corresponding sections in the preview
			htmlSectionList = [];
			var htmlSectionOffset;
			Array.prototype.forEach.call(previewElt.querySelectorAll('.classeur-preview-section'), function(delimiterElt) {
				if(htmlSectionOffset === undefined) {
					// Force start to 0 for the first section
					htmlSectionOffset = 0;
					return;
				}
				// Consider div scroll position
				var newSectionOffset = delimiterElt.offsetTop;
				htmlSectionList.push({
					startOffset: htmlSectionOffset,
					endOffset: newSectionOffset,
					height: newSectionOffset - htmlSectionOffset
				});
				htmlSectionOffset = newSectionOffset;
			});
			// Last section
			scrollHeight = previewElt.scrollHeight;
			htmlSectionList.push({
				startOffset: htmlSectionOffset,
				endOffset: scrollHeight,
				height: scrollHeight - htmlSectionOffset
			});

			// apply Scroll Link (-10 to have a gap > 9px)
			lastEditorScrollTop = -10;
			lastPreviewScrollTop = -10;
			doScrollSync();
		}, 500);

		var isPreviewVisible = layout.isPreviewOpen;
		var isEditorVisible = layout.isEditorOpen;
		var isScrollEditor;
		var isScrollPreview;
		var isEditorMoving;
		var isPreviewMoving;
		var scrollAdjust;

		var doScrollSync = throttle(function() {
			if(mdSectionList.length === 0 || mdSectionList.length !== htmlSectionList.length) {
				return;
			}
			var editorScrollTop = editorElt.scrollTop;
			editorScrollTop < 0 && (editorScrollTop = 0);
			var previewScrollTop = previewElt.scrollTop;
			var destScrollTop;
			// Perform the animation if diff > 9px
			if(isScrollEditor) {
				if(Math.abs(editorScrollTop - lastEditorScrollTop) <= 9) {
					return;
				}
				isScrollEditor = false;
				// Animate the preview
				lastEditorScrollTop = editorScrollTop;
				destScrollTop = getDestScrollTop(editorScrollTop, mdSectionList, htmlSectionList);
				destScrollTop = Math.min(
					destScrollTop,
					previewElt.scrollHeight - previewElt.offsetHeight
				);

				if(Math.abs(destScrollTop - previewScrollTop) <= 9) {
					// Skip the animation if diff is <= 9
					lastPreviewScrollTop = previewScrollTop;
					return;
				}

				if(!isPreviewVisible || !isEditorVisible) {
					// Don't animate if one panel is hidden
					previewElt.scrollTop = destScrollTop;
					lastPreviewScrollTop = destScrollTop;
					return;
				}

				animate(previewElt, previewScrollTop, destScrollTop, function(currentScrollTop) {
					isPreviewMoving = true;
					lastPreviewScrollTop = currentScrollTop;
				}, function() {
					isPreviewMoving = false;
				});
			}
			else if(isScrollPreview) {
				if(Math.abs(previewScrollTop - lastPreviewScrollTop) <= 9) {
					return;
				}
				isScrollPreview = false;
				// Animate the editor
				lastPreviewScrollTop = previewScrollTop;
				destScrollTop = getDestScrollTop(previewScrollTop, htmlSectionList, mdSectionList);
				destScrollTop = Math.min(
					destScrollTop,
					editorElt.scrollHeight - editorElt.offsetHeight
				);

				if(Math.abs(destScrollTop - editorScrollTop) <= 9) {
					// Skip the animation if diff is <= 9
					lastEditorScrollTop = editorScrollTop;
					return;
				}

				if(!isPreviewVisible || !isEditorVisible) {
					// Don't animate if one panel is hidden
					editorElt.scrollTop = destScrollTop;
					lastEditorScrollTop = destScrollTop;
					return;
				}

				animate(editorElt, editorScrollTop, destScrollTop, function(currentScrollTop) {
					isEditorMoving = true;
					lastEditorScrollTop = currentScrollTop;
				}, function() {
					isEditorMoving = false;
				});
			}
		}, 50);

		layout.onTogglePreview(function(isOpen) {
			isPreviewVisible = isOpen;
		});

		layout.onToggleEditor(function(isOpen) {
			isEditorVisible = isOpen;
		});

		layout.onLayoutResized(function() {
			isScrollEditor = true;
			buildSections();
		});

		// TODO

		// Reimplement anchor scrolling to work without preview
		//$('.extension-preview-buttons .table-of-contents').on('click', 'a', function(evt) {
		//	evt.preventDefault();
		//	var id = this.hash;
		//	var anchorElt = $(id);
		//	if(!anchorElt.length) {
		//		return;
		//	}
		//	var previewScrollTop = anchorElt[0].getBoundingClientRect().top - previewElt.getBoundingClientRect().top + previewElt.scrollTop;
		//	previewElt.scrollTop = previewScrollTop;
		//	var editorScrollTop = getDestScrollTop(previewScrollTop, htmlSectionList, mdSectionList);
		//	editorElt.scrollTop = editorScrollTop;
		//});

		//var previewContentsElt;
		//var previousHeight;
		//scrollSync.onPagedownConfigure = function(editor) {
		//	previewContentsElt = document.getElementById("preview-contents");
		//	editor.getConverter().hooks.chain("postConversion", function(text) {
		//		// To avoid losing scrolling position before elements are fully loaded
		//		previousHeight = previewContentsElt.offsetHeight;
		//		previewContentsElt.style.height = previousHeight + 'px';
		//		return text;
		//	});
		//};


		cleditor.onPreviewRefreshed(function() {
			// Now set the correct height
			//previewContentsElt.style.removeProperty('height');
			//var newHeight = previewContentsElt.offsetHeight;
			//isScrollEditor = true;
			//if(newHeight < previousHeight) {
			//	// We expect a scroll adjustment
			//	scrollAdjust = true;
			//}
			buildSections();
		});

		return scrollSync;
	});
