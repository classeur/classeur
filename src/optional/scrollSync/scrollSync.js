angular.module('classeur.optional.scrollSync', [])
	.directive('clScrollSyncSettings',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'optional/scrollSync/scrollSyncSettings.html'
			};
		})
	.directive('clScrollSyncEditor',
		function(clScrollSyncSvc) {
			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element) {
				clScrollSyncSvc.setEditorElt(element[0]);
				scope.$watch('editorSvc.sectionList', clScrollSyncSvc.onContentChanged);
				scope.$watch('editorSvc.editorSize()', clScrollSyncSvc.onPanelResized);
			}
		})
	.directive('clScrollSyncPreview',
		function(clScrollSyncSvc) {
			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element) {
				clScrollSyncSvc.setPreviewElt(element[0]);
				scope.$watch('editorSvc.lastConversion', clScrollSyncSvc.savePreviewHeight);
				scope.$watch('editorSvc.lastPreviewRefreshed', clScrollSyncSvc.restorePreviewHeight);
				scope.$watch('editorSvc.previewSize()', clScrollSyncSvc.onPanelResized);
				scope.$watch('editorLayoutSvc.isPreviewVisible', function(isVisible) {
					isVisible && clScrollSyncSvc.onPreviewOpen();
				});
				scope.$watch('editorSvc.lastSectionMeasured', function() {
					clScrollSyncSvc.updateSectionDescList();
					clScrollSyncSvc.forceScrollSync();
				});
				scope.$watch('localSettingSvc.values.scrollSync', clScrollSyncSvc.forceScrollSync);
			}
		})
	.factory('clScrollSyncSvc',
		function(clEditorLayoutSvc, clEditorSvc, clLocalSettingSvc) {
			var editorElt,
				previewElt,
				editorTimeoutId,
				previewTimeoutId,
				skipAnimation,
				isScrollEditor,
				isScrollPreview,
				isEditorMoving,
				isPreviewMoving,
				sectionDescList;

			var doScrollSync = function(debounce) {
				var localSkipAnimation = skipAnimation;
				skipAnimation = false;
				if (!clLocalSettingSvc.values.scrollSync || !sectionDescList || sectionDescList.length === 0) {
					return;
				}
				var editorScrollTop = editorElt.scrollTop;
				editorScrollTop < 0 && (editorScrollTop = 0);
				var previewScrollTop = previewElt.scrollTop;
				var destScrollTop;
				if (isScrollEditor) {

					// Scroll the preview
					isScrollEditor = false;
					editorScrollTop += clEditorSvc.scrollOffset;
					sectionDescList.some(function(sectionDesc) {
						if (editorScrollTop < sectionDesc.editorDimension.endOffset) {
							var posInSection = (editorScrollTop - sectionDesc.editorDimension.startOffset) / (sectionDesc.editorDimension.height || 1);
							destScrollTop = sectionDesc.previewDimension.startOffset + sectionDesc.previewDimension.height * posInSection - clEditorSvc.scrollOffset;
							return true;
						}
					});
					destScrollTop = Math.min(
						destScrollTop,
						previewElt.scrollHeight - previewElt.offsetHeight
					);

					if (Math.abs(destScrollTop - previewScrollTop) <= 9) {
						// Skip the animation if diff is less than 10
						return;
					}

					clearTimeout(previewTimeoutId);
					previewElt.clAnim
						.scrollTop(destScrollTop)
						.duration(!debounce && !localSkipAnimation && 100)
						.delay(debounce && 50)
						.start(function() {
							previewTimeoutId = setTimeout(function() {
								isPreviewMoving = false;
							}, 100);
						}, function() {
							isPreviewMoving = true;
						});
				} else if (!clEditorLayoutSvc.isEditorOpen || isScrollPreview) {

					// Scroll the editor
					isScrollPreview = false;
					previewScrollTop += clEditorSvc.scrollOffset;
					sectionDescList.some(function(sectionDesc) {
						if (previewScrollTop < sectionDesc.previewDimension.endOffset) {
							var posInSection = (previewScrollTop - sectionDesc.previewDimension.startOffset) / (sectionDesc.previewDimension.height || 1);
							destScrollTop = sectionDesc.editorDimension.startOffset + sectionDesc.editorDimension.height * posInSection - clEditorSvc.scrollOffset;
							return true;
						}
					});
					destScrollTop = Math.min(
						destScrollTop,
						editorElt.scrollHeight - editorElt.offsetHeight
					);

					if (Math.abs(destScrollTop - editorScrollTop) <= 9) {
						// Skip the animation if diff is less than 10
						return;
					}

					clearTimeout(editorTimeoutId);
					editorElt.clAnim
						.scrollTop(destScrollTop)
						.duration(!debounce && !localSkipAnimation && 100)
						.delay(debounce && 50)
						.start(function() {
							editorTimeoutId = setTimeout(function() {
								isEditorMoving = false;
							}, 100);
						}, function() {
							isEditorMoving = true;
						});
				}
			};

			var oldEditorElt, oldPreviewElt;
			var isPreviewRefreshing;

			function init() {
				if (oldEditorElt === editorElt || oldPreviewElt === previewElt) {
					return;
				}
				oldEditorElt = editorElt;
				oldPreviewElt = previewElt;

				editorElt.addEventListener('scroll', function() {
					if (isEditorMoving) {
						return;
					}
					isScrollEditor = true;
					isScrollPreview = false;
					doScrollSync(!clEditorLayoutSvc.isSidePreviewOpen);
				});

				previewElt.addEventListener('scroll', function() {
					if (isPreviewMoving || isPreviewRefreshing) {
						return;
					}
					isScrollPreview = true;
					isScrollEditor = false;
					doScrollSync(!clEditorLayoutSvc.isSidePreviewOpen);
				});
			}

			var previewHeight, previewContentElt, timeoutId;
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
					clearTimeout(timeoutId);
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
					isScrollEditor = clEditorLayoutSvc.isEditorOpen;
					// A preview scrolling event can occur if height is smaller
					timeoutId = setTimeout(function() {
						isPreviewRefreshing = false;
					}, 100);
				},
				onPanelResized: function() {
					// This could happen before the editor/preview panels are created
					if (!editorElt) {
						return;
					}
					isScrollEditor = clEditorLayoutSvc.isEditorOpen;
				},
				onPreviewOpen: function() {
					isScrollEditor = true;
					isScrollPreview = false;
					skipAnimation = true;
				},
				updateSectionDescList: function() {
					sectionDescList = clEditorSvc.sectionDescList;
				},
				forceScrollSync: function() {
					if (isPreviewRefreshing) {
						return;
					}
					// Force Scroll Sync
					lastEditorScrollTop = -10;
					lastPreviewScrollTop = -10;
					doScrollSync(!clEditorLayoutSvc.isSidePreviewOpen);
				}
			};
		});
