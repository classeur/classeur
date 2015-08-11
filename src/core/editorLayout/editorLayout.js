angular.module('classeur.core.editorLayout', [])
	.directive('clFileName',
		function(clEditorLayoutSvc) {
			return {
				restrict: 'E',
				templateUrl: 'core/editorLayout/fileName.html',
				link: link
			};

			function link(scope) {
				var fileDao = scope.currentFileDao;
				scope.name = function(name) {
					if (name) {
						fileDao.name = name;
					} else if (!fileDao.name) {
						fileDao.name = 'Untitled';
					}
					return fileDao.name;
				};
				scope.name();
				scope.keydown = function(e) {
					if (e.which == 27) {
						scope.nameForm.$rollbackViewValue();
						clEditorLayoutSvc.currentControl = undefined;
					} else if (e.which === 13) {
						clEditorLayoutSvc.currentControl = undefined;
					}
				};
			}
		})
	.directive('clEditorLayout',
		function($window, clEditorLayoutSvc, clSettingSvc, clLocalSettingSvc, clEditorSvc, clFilePropertiesDialog) {
			var hideOffsetY = 2000;

			return {
				restrict: 'E',
				templateUrl: 'core/editorLayout/editorLayout.html',
				link: link
			};

			function link(scope, element) {
				element[0].querySelector('.side-bar.panel').clAnim.width(clEditorLayoutSvc.sideBarWidth).start();
				var backgroundPanelElt = element[0].querySelector('.background.panel');
				var previewPanelElt = element[0].querySelector('.preview.panel');
				var previewContainerElt = element[0].querySelector('.preview.container');
				var binderPanelElt = element[0].querySelector('.binder.panel').clAnim.top(-hideOffsetY).start();
				var editBtnElt = element[0].querySelector('.edit.btn-panel').clAnim.bottom(-hideOffsetY - 20).start();
				var editorPanelElt = element[0].querySelector('.editor.panel').clAnim.top(hideOffsetY).start();
				var pagePanelElt = element[0].querySelector('.page.panel').clAnim.left(clEditorLayoutSvc.pageMarginLeft).start();
				element[0].querySelector('.menu.scroller').clAnim.width(clEditorLayoutSvc.menuWidth + 50).right(-50).start();
				element[0].querySelector('.menu.content').clAnim.width(clEditorLayoutSvc.menuWidth).start();
				element[0].querySelector('.editor .btn-grp.panel').clAnim.width(clEditorLayoutSvc.editorBtnGrpWidth - 2).right(-clEditorLayoutSvc.editorBtnGrpWidth + 2).start();
				var cornerFoldingElt = element[0].querySelector('.corner.folding.panel');
				element[0].querySelector('.corner.folding .shadow.panel').clAnim.rotate(-45).start();
				var headerPanelElt = element[0].querySelector('.header.panel').clAnim.top(hideOffsetY).start();
				var headerBtnGrpElt = headerPanelElt.querySelector('.btn-grp.panel');
				var closeButtonElt = headerPanelElt.querySelector('.close.panel');
				var scrollButtonElt = headerPanelElt.querySelector('.scroll.panel');

				var binderMinWidth = 280;
				var previewSizeAdjust = 160;
				var leftMarginOverflow = 90;
				var binderWidthFactor = (clSettingSvc.values.editorBinderWidthFactor + 10) / 15;
				var fontSizeFactor = (clSettingSvc.values.editorFontSizeFactor + 10) / 15;

				function updateLayout() {
					var bgWidth = document.body.clientWidth;
					if (clLocalSettingSvc.values.sideBar) {
						bgWidth -= clEditorLayoutSvc.sideBarWidth;
					}
					clEditorLayoutSvc.fontSize = 18;
					var factor = 1 + (clLocalSettingSvc.values.editorZoom - 3) * 0.1;
					clEditorLayoutSvc.pageWidth = 990 * factor;
					if (bgWidth < 1120) {
						--clEditorLayoutSvc.fontSize;
						clEditorLayoutSvc.pageWidth = 910 * factor;
					}
					if (bgWidth < 1040) {
						clEditorLayoutSvc.pageWidth = 830 * factor;
					}
					if (bgWidth < binderMinWidth) {
						bgWidth = binderMinWidth;
					}
					clEditorLayoutSvc.pageWidth *= binderWidthFactor;
					var marginRight = (bgWidth - clEditorLayoutSvc.pageWidth) / 2;
					marginRight = marginRight > 0 ? marginRight : 0;
					if (bgWidth + leftMarginOverflow < clEditorLayoutSvc.pageWidth) {
						clEditorLayoutSvc.pageWidth = bgWidth + leftMarginOverflow;
					}
					if (clEditorLayoutSvc.pageWidth < 640) {
						--clEditorLayoutSvc.fontSize;
					}
					clEditorLayoutSvc.fontSize *= fontSizeFactor;
					if (clEditorLayoutSvc.isSidePreviewOpen) {
						if (bgWidth / 2 < binderMinWidth) {
							clEditorLayoutSvc.isSidePreviewOpen = false;
						} else {
							var maxWidth = bgWidth / 2 + clEditorLayoutSvc.editorBtnGrpWidth + leftMarginOverflow;

							if (maxWidth < clEditorLayoutSvc.pageWidth) {
								clEditorLayoutSvc.pageWidth = maxWidth;
							}
							marginRight = bgWidth / 2 - clEditorLayoutSvc.editorBtnGrpWidth;
						}
					}

					clEditorLayoutSvc.backgroundX = clLocalSettingSvc.values.sideBar ? -clEditorLayoutSvc.sideBarWidth : 0;
					clEditorLayoutSvc.binderWidth = clEditorLayoutSvc.pageWidth - clEditorLayoutSvc.editorBtnGrpWidth;
					clEditorLayoutSvc.binderX = bgWidth - (clEditorLayoutSvc.pageWidth + clEditorLayoutSvc.editorBtnGrpWidth) / 2 - marginRight;
					clEditorLayoutSvc.binderX += clLocalSettingSvc.values.sideBar ? clEditorLayoutSvc.sideBarWidth : 0;
					clEditorLayoutSvc.previewWidth = clEditorLayoutSvc.pageWidth - previewSizeAdjust + 2000;
					clEditorLayoutSvc.previewHeaderWidth = clEditorLayoutSvc.pageWidth - previewSizeAdjust - 20;
					clEditorLayoutSvc.previewX = clEditorLayoutSvc.binderX;
					clEditorLayoutSvc.previewX += clEditorLayoutSvc.isSidePreviewOpen ? clEditorLayoutSvc.pageWidth - previewSizeAdjust / 2 : 20;
					clEditorLayoutSvc.editorX = clEditorLayoutSvc.isMenuOpen ? 5 : 0;
					clEditorLayoutSvc.editorY = clEditorLayoutSvc.isEditorOpen ? 0 : hideOffsetY;
					clEditorLayoutSvc.pageX = clEditorLayoutSvc.isMenuOpen ? -clEditorLayoutSvc.menuWidth : 0;
					clEditorLayoutSvc.pageY = clEditorLayoutSvc.isMenuOpen ? -100 : 0;
					clEditorLayoutSvc.pageRotate = clEditorLayoutSvc.isMenuOpen ? -2 : 0;
					scope.showHelp = clSettingSvc.values.editorMdCheatSheetBtn && clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isSidePreviewOpen && !scope.currentFileDao.isReadOnly;
				}

				function hidePreview() {
					if (clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isSidePreviewOpen) {
						clEditorLayoutSvc.isPreviewVisible = false;
						previewPanelElt.classList.add('hidden');
					}
				}

				function showPreview() {
					if (!clEditorLayoutSvc.isEditorOpen || clEditorLayoutSvc.isSidePreviewOpen) {
						clEditorLayoutSvc.isPreviewVisible = true;
						previewPanelElt.classList.remove('hidden');
						previewPanelElt.offsetHeight; // Force refresh
						updateLayoutSize(); // Update width according to scrollbar visibility
					}
				}

				var sectionDescList;

				function updateLayoutSize() {
					var previewScrollbarWidth = previewContainerElt.offsetWidth - previewContainerElt.clientWidth;
					var eltToScroll = clEditorSvc.editorElt.parentNode,
						dimensionKey = 'editorDimension';
					if (!clEditorLayoutSvc.isEditorOpen) {
						eltToScroll = clEditorSvc.previewElt.parentNode, dimensionKey = 'previewDimension';
					}
					var scrollTop = eltToScroll.scrollTop;
					var scrollSectionDesc, posInSection;
					sectionDescList === clEditorSvc.sectionDescList && sectionDescList.some(function(sectionDesc) {
						if (scrollTop < sectionDesc[dimensionKey].endOffset) {
							scrollSectionDesc = sectionDesc;
							posInSection = (scrollTop - sectionDesc[dimensionKey].startOffset) / (sectionDesc[dimensionKey].height || 1);
							return true;
						}
					});

					clEditorLayoutSvc.fontSizePx = clEditorLayoutSvc.fontSize + 'px';
					clEditorLayoutSvc.fontSizeEm = (7 + clLocalSettingSvc.values.editorZoom) / 10 + 'em';
					binderPanelElt.clAnim
						.width(clEditorLayoutSvc.binderWidth)
						.left(-clEditorLayoutSvc.binderWidth / 2)
						.start();
					previewPanelElt.clAnim
						.width(clEditorLayoutSvc.previewWidth)
						.left(-clEditorLayoutSvc.previewWidth / 2)
						.start();
					headerPanelElt.clAnim
						.width(clEditorLayoutSvc.previewHeaderWidth - previewScrollbarWidth)
						.start();
					pagePanelElt.clAnim
						.width(clEditorLayoutSvc.binderWidth - clEditorLayoutSvc.pageMarginLeft - clEditorLayoutSvc.pageMarginRight)
						.start();
					hidePreview();

					if (scrollSectionDesc) {
						setTimeout(function() {
							clEditorSvc.measureSectionDimensions();
							scrollTop = scrollSectionDesc[dimensionKey].startOffset + scrollSectionDesc[dimensionKey].height * posInSection;
							eltToScroll.scrollTop = scrollTop;
						}, 10);
					}
				}

				function animateLayout() {
					showPreview();
					updateLayout();
					backgroundPanelElt.clAnim
						.translateX(clEditorLayoutSvc.backgroundX)
						.duration(isInited && 200)
						.easing('outCubic')
						.start();
					binderPanelElt.clAnim
						.translateX(clEditorLayoutSvc.binderX)
						.duration(isInited && 200)
						.easing('outCubic')
						.start();
					previewPanelElt.clAnim
						.translateX(clEditorLayoutSvc.previewX)
						.duration(isInited && 200)
						.easing('outCubic')
						.start(function() {
							setTimeout(function() {
								updateLayoutSize();
								scope.$apply();
							}, 100);
						});
				}

				animateLayout();
				updateLayoutSize();

				function animateEditor() {
					showPreview();
					updateLayout();
					editorPanelElt.clAnim
						.translateX(clEditorLayoutSvc.editorX)
						.translateY(clEditorLayoutSvc.editorY)
						.duration(isInited && 200)
						.easing(clEditorLayoutSvc.isEditorOpen ? 'outCubic' : 'inCubic')
						.start(true);
					setTimeout(function() {
						editBtnElt.clAnim
							.translateY(clEditorLayoutSvc.isEditorOpen ? 100 : 0)
							.duration(200)
							.easing('outBack')
							.start(true);
						setTimeout(function() {
							hidePreview();
							clEditorLayoutSvc.toggleSidePreview(false);
							clEditorLayoutSvc.currentControl = undefined;
							isInited && scope.$apply();
						}, 300);
					}, 300);
				}

				function animateMenu() {
					updateLayout();
					pagePanelElt.clAnim
						.translateX(clEditorLayoutSvc.pageX)
						.translateY(clEditorLayoutSvc.pageY)
						.rotate(clEditorLayoutSvc.pageRotate)
						.duration(200)
						.easing('outBack')
						.start(true);
					editorPanelElt.clAnim
						.translateX(clEditorLayoutSvc.editorX)
						.translateY(clEditorLayoutSvc.editorY)
						.duration(isInited && 200)
						.start(true);
				}

				function animateCornerFolding() {
					if (!clEditorLayoutSvc.isCornerFoldingOpen) {
						clEditorLayoutSvc.isCornerFoldingVisible = false;
					}
					cornerFoldingElt.clAnim
						.duration(isInited && 200)
						.scale(clEditorLayoutSvc.isCornerFoldingOpen ? 2.5 : 1)
						.start(function() {
							if (clEditorLayoutSvc.isCornerFoldingOpen) {
								clEditorLayoutSvc.isCornerFoldingVisible = true;
								isInited && scope.$apply();
							}
						});
				}

				function animatePreviewButtons(isPreviewTop) {
					headerBtnGrpElt.clAnim
						.duration(isInited && 200)
						.rotate(isPreviewTop ? 0 : 90)
						.start(true);
					closeButtonElt.clAnim
						.zIndex(isPreviewTop ? 0 : -1)
						.opacity(isPreviewTop ? 1 : 0)
						.duration(isInited && 200)
						.easing('inOutExpo')
						.start(true);
					scrollButtonElt.clAnim
						.zIndex(isPreviewTop ? -1 : 0)
						.opacity(isPreviewTop ? 0 : 1)
						.duration(isInited && 200)
						.easing('inOutExpo')
						.start(true);
				}

				scope.editFileProperties = function() {
					clEditorLayoutSvc.currentControl = 'editProperties';
					var fileDao = scope.currentFileDao;
					clFilePropertiesDialog(fileDao.contentDao.properties)
						.then(function(properties) {
							clEditorLayoutSvc.currentControl = undefined;
							if (fileDao === scope.currentFileDao) {
								fileDao.contentDao.properties = properties;
							}
						}, function() {
							clEditorLayoutSvc.currentControl = undefined;
						});
				};

				var tabs = ['sample', 'toc', 'discussions'];
				scope.$watch('editorLayoutSvc.sideBarTab', function(tab) {
					scope.selectedTabIndex = tabs.indexOf(tab);
				});
				scope.$watch('selectedTabIndex', function(index) {
					clEditorLayoutSvc.sideBarTab = tabs[index || 0];
				});

				var isInited;
				setTimeout(function() {
					isInited = true;
				}, 1);

				var debouncedAnimateLayout = window.cledit.Utils.debounce(animateLayout, 50);
				window.addEventListener('resize', debouncedAnimateLayout);
				scope.$on('$destroy', function() {
					window.removeEventListener('resize', debouncedAnimateLayout);
					clEditorLayoutSvc.clean();
				});

				scope.$watch('localSettingSvc.values.editorZoom', animateLayout);
				scope.$watch('localSettingSvc.values.editorColor', function(value) {
					scope.plasticClass = 'plastic-' + (value - 1);
				});
				scope.$watch('editorLayoutSvc.isSidePreviewOpen', animateLayout);
				scope.$watch('editorLayoutSvc.isEditorOpen', animateEditor);
				scope.$watch('editorLayoutSvc.isMenuOpen', animateMenu);
				scope.$watch('localSettingSvc.values.sideBar', animateLayout);
				scope.$watch('editorLayoutSvc.isCornerFoldingOpen', animateCornerFolding);
				scope.$watch('editorLayoutSvc.currentControl === "menu"', function(isMenuOpen) {
					clEditorLayoutSvc.isMenuOpen = isMenuOpen;
				});
				scope.$watch('editorSvc.isPreviewTop', animatePreviewButtons);
				scope.$watch('editorSvc.lastSectionMeasured', function() {
					sectionDescList = clEditorSvc.sectionDescList;
				});
			}
		})
	.factory('clEditorLayoutSvc',
		function($window, $rootScope, clLocalSettingSvc) {
			var clEditorLayoutSvc = {
				pageMarginLeft: 4,
				pageMarginRight: 6,
				editorBtnGrpWidth: 36,
				menuWidth: 320,
				sideBarWidth: 280,
				statHeight: 30,
				init: function(hideEditor) {
					this.isEditorOpen = !hideEditor;
					this.isSidePreviewOpen = false;
					this.sideBarTab = 'toc';
					this.isMenuOpen = false;
					this.isCornerFoldingOpen = false;
				},
				toggleEditor: function(isOpen) {
					this.isEditorOpen = isOpen === undefined ? !this.isEditorOpen : isOpen;
				},
				toggleSidePreview: function(isOpen) {
					this.isSidePreviewOpen = isOpen === undefined ? !this.isSidePreviewOpen : isOpen;
				},
				toggleMenu: function() {
					this.currentControl = this.currentControl === 'menu' ? undefined : 'menu';
				},
				toggleSideBar: function(isOpen) {
					clLocalSettingSvc.values.sideBar = isOpen === undefined ? !clLocalSettingSvc.values.sideBar : isOpen;
				},
				toggleStat: function(isOpen) {
					clLocalSettingSvc.values.stat = isOpen === undefined ? !clLocalSettingSvc.values.stat : isOpen;
				},
				toggleCornerFolding: function(isOpen) {
					this.isCornerFoldingOpen = isOpen === undefined ? !this.isCornerFoldingOpen : isOpen;
				},
				clean: function() {
					this.currentControl = undefined;
				}
			};

			$window.addEventListener('keydown', function(evt) {
				if (evt.which === 27) {
					// Esc key
					evt.preventDefault();
					clEditorLayoutSvc.currentControl = undefined;
					$rootScope.$apply();
				}
			});

			return clEditorLayoutSvc;
		});
