angular.module('classeur.extensions.scrollSync', [])
	.directive('clScrollSyncEditor', function(scrollSync) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				scrollSync.setEditorElt(element[0]);
				scope.$watch('editor.cledit', function(editor) {
					editor && editor.on('contentChanged', scrollSync.onContentChanged);
				});
				scope.$watch('editor.lastConvert', scrollSync.savePreviewHeight);
				scope.$watch('editor.lastPreview', scrollSync.restorePreviewHeight);
				scope.$watch('editor.editorSize()', scrollSync.onPanelResized);
				scope.$watch('editor.previewSize()', scrollSync.onPanelResized);
				scope.$watch('editor.lastMeasure', scrollSync.onMeasure);
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
	.factory('scrollSync', function(layout, editor, settings) {
		settings.setDefaultValue('scrollSync', true);

		var editorElt, previewElt;
		var scrollSyncOffset = 100;
		var timeoutId;
		var currentEndCb;

		function scroll(elt, startValue, endValue, stepCb, endCb, debounce) {
			clearTimeout(timeoutId);
			if(currentEndCb) {
				currentEndCb();
			}
			currentEndCb = endCb;
			var diff = endValue - startValue;
			var startTime = debounce ? 0 : Date.now();

			function tick() {
				var currentTime = Date.now();
				var progress = (currentTime - startTime) / 180;
				var scrollTop = endValue;
				if(progress < 1) {
					scrollTop = startValue + diff * Math.cos((1 - progress) * Math.PI / 2);
					timeoutId = setTimeout(tick, 1);
				}
				else {
					timeoutId = setTimeout(function() {
						currentEndCb();
						currentEndCb = undefined;
					}, 100);
				}
				elt.scrollTop = scrollTop;
				stepCb(scrollTop);
			}

			if(!debounce) {
				return tick();
			}
			stepCb(startValue);
			timeoutId = setTimeout(tick, 100);
		}

		var lastEditorScrollTop;
		var lastPreviewScrollTop;
		var isScrollEditor;
		var isScrollPreview;
		var isEditorMoving;
		var isPreviewMoving;
		var sectionDescList;

		var doScrollSync = function(debounce) {
			if(!settings.values.scrollSync || !sectionDescList || sectionDescList.length === 0) {
				return;
			}
			var editorScrollTop = editorElt.scrollTop;
			editorScrollTop < 0 && (editorScrollTop = 0);
			var previewScrollTop = previewElt.scrollTop;
			var destScrollTop;
			if(isScrollEditor) {

				// Scroll the preview
				isScrollEditor = false;
				lastEditorScrollTop = editorScrollTop;
				editorScrollTop += scrollSyncOffset;
				sectionDescList.some(function(sectionDesc) {
					if(editorScrollTop < sectionDesc.editorDimension.endOffset) {
						var posInSection = (editorScrollTop - sectionDesc.editorDimension.startOffset) / (sectionDesc.editorDimension.height || 1);
						destScrollTop = sectionDesc.previewDimension.startOffset + sectionDesc.previewDimension.height * posInSection - scrollSyncOffset;
						return true;
					}
				});
				destScrollTop = Math.min(
					destScrollTop,
					previewElt.scrollHeight - previewElt.offsetHeight
				);

				if(Math.abs(destScrollTop - previewScrollTop) <= 9) {
					// Skip the animation if diff is <= 9
					lastPreviewScrollTop = previewScrollTop;
					return;
				}

				scroll(previewElt, previewScrollTop, destScrollTop, function(currentScrollTop) {
					isPreviewMoving = true;
					lastPreviewScrollTop = currentScrollTop;
				}, function() {
					isPreviewMoving = false;
				}, debounce);
			}
			else if(!layout.isEditorOpen || isScrollPreview) {

				// Scroll the editor
				isScrollPreview = false;
				lastPreviewScrollTop = previewScrollTop;
				previewScrollTop += scrollSyncOffset;
				sectionDescList.some(function(sectionDesc) {
					if(previewScrollTop < sectionDesc.previewDimension.endOffset) {
						var posInSection = (previewScrollTop - sectionDesc.previewDimension.startOffset) / (sectionDesc.previewDimension.height || 1);
						destScrollTop = sectionDesc.editorDimension.startOffset + sectionDesc.editorDimension.height * posInSection - scrollSyncOffset;
						return true;
					}
				});
				destScrollTop = Math.min(
					destScrollTop,
					editorElt.scrollHeight - editorElt.offsetHeight
				);

				if(Math.abs(destScrollTop - editorScrollTop) <= 9) {
					// Skip the animation if diff is <= 9
					lastEditorScrollTop = editorScrollTop;
					return;
				}

				scroll(editorElt, editorScrollTop, destScrollTop, function(currentScrollTop) {
					isEditorMoving = true;
					lastEditorScrollTop = currentScrollTop;
				}, function() {
					isEditorMoving = false;
				}, debounce);
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
				if(isEditorMoving) {
					return;
				}
				isScrollEditor = true;
				isScrollPreview = false;
				doScrollSync(layout.isEditorOpen && !layout.isSidePreviewOpen);
			});

			previewElt.addEventListener('scroll', function() {
				if(isPreviewMoving) {
					return;
				}
				isScrollPreview = true;
				isScrollEditor = false;
				doScrollSync(!layout.isEditorOpen);
			});
		}

		var previewHeight, previewContentElt;
		var isPreviewRefreshing;
		return {
			setEditorElt: function(elt) {
				editorElt = elt;
				init();
			},
			setPreviewElt: function(elt) {
				previewElt = elt;
				previewContentElt = previewElt.children[0];
				init();
			},
			onContentChanged: function() {
				isPreviewRefreshing = true;
				sectionDescList = undefined;
			},
			savePreviewHeight: function() {
				previewHeight = previewContentElt.offsetHeight;
				previewContentElt.style.height = previewHeight + 'px';
			},
			restorePreviewHeight: function() {
				// Now set the correct height
				previewContentElt.style.removeProperty('height');
				isScrollEditor = layout.isEditorOpen;
				isPreviewRefreshing = false;
			},
			onPanelResized: function() {
				// This could happen before the editor/preview panels are created
				if(!editorElt) {
					return;
				}
				isScrollEditor = layout.isEditorOpen;
			},
			onMeasure: function() {
				if(isPreviewRefreshing) {
					return;
				}
				sectionDescList = editor.sectionDescList;
				// Force Scroll Sync (-10 to have a gap > 9px)
				lastEditorScrollTop = -10;
				lastPreviewScrollTop = -10;
				doScrollSync(!layout.isEditorOpen || !layout.isSidePreviewOpen);
			}
		};

	});
