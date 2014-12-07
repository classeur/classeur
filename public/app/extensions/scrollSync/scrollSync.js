angular.module('classeur.extensions.scrollSync', [])
	.directive('clScrollSyncEditor', function(scrollSync) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				scrollSync.setEditorElt(element[0]);
				scope.$watch('cledit.lastPreview', scrollSync.onPreviewRefreshed);
				scope.$watch('layout.pageWidth', scrollSync.onLayoutResized);
				scope.$watch('layout.fontSize', scrollSync.onLayoutResized);
				scope.$watch('settings.values.zoom', scrollSync.onLayoutResized);
			}
		};
	})
	.directive('clScrollSyncPreview', function(scrollSync) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				scrollSync.setPreviewElt(element[0]);
			}
		};
	})
	.directive('clScrollSyncSettings', function() {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/scrollSync/scrollSyncSettings.html'
		};
	})
	.factory('scrollSync', function(layout, cledit, settings) {
		settings.setDefaultValue('scrollSync', true);
		var editorElt, previewElt;

		var scrollSyncOffset = 120;

		var timeoutId;
		var currentEndCb;

		function animate(elt, startValue, endValue, stepCb, endCb) {
			if(currentEndCb) {
				clearTimeout(timeoutId);
				currentEndCb();
			}
			currentEndCb = endCb;
			var diff = endValue - startValue;
			var startTime = 0;

			// Animation only if both panels are visible
			if(layout.isSidePreviewOpen && layout.isEditorOpen) {
				startTime = Date.now();
			}

			function tick() {
				var currentTime = Date.now();
				var progress = (currentTime - startTime) / 180;
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

		var mdSectionList = [];
		var htmlSectionList = [];
		var lastEditorScrollTop;
		var lastPreviewScrollTop;
		var buildSections = window.ced.Utils.debounce(function() {

			mdSectionList = [];
			var mdSectionOffset;
			var scrollHeight;
			Array.prototype.forEach.call(editorElt.querySelectorAll('.classeur-editor-section'), function(sectionElt) {
				if(mdSectionOffset === undefined) {
					// Force start to 0 for the first section
					mdSectionOffset = 0;
					return;
				}
				sectionElt = sectionElt.firstChild;
				// Consider div scroll position
				var newSectionOffset = sectionElt.offsetTop;
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
			Array.prototype.forEach.call(previewElt.querySelectorAll('.classeur-preview-section'), function(sectionElt) {
				if(htmlSectionOffset === undefined) {
					// Force start to 0 for the first section
					htmlSectionOffset = 0;
					return;
				}
				// Consider div scroll position
				var newSectionOffset = sectionElt.offsetTop;
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

			// apply Scroll Sync (-10 to have a gap > 9px)
			lastEditorScrollTop = -10;
			lastPreviewScrollTop = -10;
			doScrollSync();
		}, 500);

		var isScrollEditor;
		var isScrollPreview;
		var isEditorMoving;
		var isPreviewMoving;
		var scrollAdjust;

		var doScrollSync = function() {
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

				animate(previewElt, previewScrollTop, destScrollTop, function(currentScrollTop) {
					isPreviewMoving = true;
					lastPreviewScrollTop = currentScrollTop;
				}, function() {
					isPreviewMoving = false;
				});
			}
			else if(!layout.isEditorOpen || isScrollPreview) {
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

				animate(editorElt, editorScrollTop, destScrollTop, function(currentScrollTop) {
					isEditorMoving = true;
					lastEditorScrollTop = currentScrollTop;
				}, function() {
					isEditorMoving = false;
				});
			}
		};

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


		var oldEditorElt, oldPreviewElt;
		function init() {
			if(oldEditorElt === editorElt || oldPreviewElt === previewElt) {
				return;
			}
			oldEditorElt = editorElt;
			oldPreviewElt = previewElt;

			editorElt.addEventListener('scroll', function() {
				if(!settings.values.scrollSync) {
					return;
				}
				if(!isEditorMoving) {
					isScrollEditor = true;
					isScrollPreview = false;
					doScrollSync();
				}
			});

			previewElt.addEventListener('scroll', function() {
				if(!settings.values.scrollSync) {
					return;
				}
				if(!isPreviewMoving && !scrollAdjust) {
					isScrollPreview = true;
					isScrollEditor = false;
					doScrollSync();
				}
				scrollAdjust = false;
			});

		}

		return {
			setEditorElt: function(elt) {
				editorElt = elt;
				init();
			},
			setPreviewElt: function(elt) {
				previewElt = elt;
				init();
			},
			onPreviewRefreshed: function() {
				// Now set the correct height
				//previewContentsElt.style.removeProperty('height');
				//var newHeight = previewContentsElt.offsetHeight;
				isScrollEditor = true;
				//if(newHeight < previousHeight) {
				//	// We expect a scroll adjustment
				//	scrollAdjust = true;
				//}
				buildSections();
			},
			onLayoutResized: function() {
				// This could happen before the editor/preview panels are created
				if(!editorElt) {
					return;
				}
				isScrollEditor = true;
				buildSections();
			}
		};

	});
