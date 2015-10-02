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
				editorFinishTimeoutId,
				previewFinishTimeoutId,
				skipAnimation,
				isScrollEditor,
				isScrollPreview,
				isEditorMoving,
				isPreviewMoving,
				sectionDescList;

			var throttleTimeoutId, throttleLastTime = 0;

			function throttle(func, wait) {
				clearTimeout(throttleTimeoutId);
				var currentTime = Date.now();
				var localWait = wait + throttleLastTime - currentTime;
				throttleTimeoutId = setTimeout(function() {
					throttleLastTime = Date.now();
					func();
				}, localWait < 1 ? 1 : localWait);
			}

			var doScrollSync = function() {
				var localSkipAnimation = skipAnimation || !clEditorLayoutSvc.isSidePreviewOpen;
				skipAnimation = false;
				if (!clLocalSettingSvc.values.scrollSync || !sectionDescList || sectionDescList.length === 0) {
					return;
				}
				var editorScrollTop = editorElt.scrollTop;
				editorScrollTop < 0 && (editorScrollTop = 0);
				var previewScrollTop = previewElt.scrollTop;
				var scrollTo;
				if (isScrollEditor) {

					// Scroll the preview
					isScrollEditor = false;
					editorScrollTop += clEditorSvc.scrollOffset;
					sectionDescList.cl_some(function(sectionDesc) {
						if (editorScrollTop < sectionDesc.editorDimension.endOffset) {
							var posInSection = (editorScrollTop - sectionDesc.editorDimension.startOffset) / (sectionDesc.editorDimension.height || 1);
							scrollTo = sectionDesc.previewDimension.startOffset + sectionDesc.previewDimension.height * posInSection - clEditorSvc.scrollOffset;
							return true;
						}
					});
					scrollTo = Math.min(
						scrollTo,
						previewElt.scrollHeight - previewElt.offsetHeight
					);

					throttle(function() {
						clearTimeout(previewFinishTimeoutId);
						previewElt.clanim
							.scrollTop(scrollTo)
							.duration(!localSkipAnimation && 100)
							.start(function() {
								previewFinishTimeoutId = setTimeout(function() {
									isPreviewMoving = false;
								}, 100);
							}, function() {
								isPreviewMoving = true;
							});
					}, localSkipAnimation ? 500 : 10);
				} else if (!clEditorLayoutSvc.isEditorOpen || isScrollPreview) {

					// Scroll the editor
					isScrollPreview = false;
					previewScrollTop += clEditorSvc.scrollOffset;
					sectionDescList.cl_some(function(sectionDesc) {
						if (previewScrollTop < sectionDesc.previewDimension.endOffset) {
							var posInSection = (previewScrollTop - sectionDesc.previewDimension.startOffset) / (sectionDesc.previewDimension.height || 1);
							scrollTo = sectionDesc.editorDimension.startOffset + sectionDesc.editorDimension.height * posInSection - clEditorSvc.scrollOffset;
							return true;
						}
					});
					scrollTo = Math.min(
						scrollTo,
						editorElt.scrollHeight - editorElt.offsetHeight
					);

					throttle(function() {
						clearTimeout(editorFinishTimeoutId);
						editorElt.clanim
							.scrollTop(scrollTo)
							.duration(!localSkipAnimation && 100)
							.start(function() {
								editorFinishTimeoutId = setTimeout(function() {
									isEditorMoving = false;
								}, 100);
							}, function() {
								isEditorMoving = true;
							});
					}, localSkipAnimation ? 500 : 10);
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
					doScrollSync(!clEditorLayoutSvc.isSidePreviewOpen);
				}
			};
		});
