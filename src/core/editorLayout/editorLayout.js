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
				var elt = element[0];
				elt.querySelector('.side-bar.panel').clanim.width(clEditorLayoutSvc.sideBarWidth).start();
				var backgroundPanelElt = elt.querySelector('.background.panel');
				var previewPanelElt = elt.querySelector('.preview.panel');
				var previewContainerElt = elt.querySelector('.preview.container');
				var binderPanelElt = elt.querySelector('.binder.panel').clanim.top(-hideOffsetY).start();
				var editorPanelElt = elt.querySelector('.editor.panel').clanim.top(hideOffsetY).start();
				var pagePanelElt = elt.querySelector('.page.panel').clanim.left(clEditorLayoutSvc.pageMarginLeft).start();
				var editorContainerElt = elt.querySelector('.editor.container');
				var editorContentElt = elt.querySelector('.editor.content');
				elt.querySelector('.menu.scroller').clanim.width(clEditorLayoutSvc.menuWidth + 50).right(-50).start();
				elt.querySelector('.menu.content').clanim.width(clEditorLayoutSvc.menuWidth).start();
				elt.querySelector('.editor .btn-grp.panel').clanim.width(clEditorLayoutSvc.editorBtnGrpWidth).right(-clEditorLayoutSvc.editorBtnGrpWidth).start();
				var cornerFoldingElt = elt.querySelector('.corner.folding.panel');
				elt.querySelector('.corner.folding .shadow.panel').clanim.rotate(-45).start();
				var headerPanelElt = elt.querySelector('.header.panel').clanim.top(hideOffsetY).start();
				var headerBtnGrpElt = headerPanelElt.querySelector('.btn-grp.panel');
				var closeButtonElt = headerPanelElt.querySelector('.close.panel');
				var scrollButtonElt = headerPanelElt.querySelector('.scroll.panel');

				editorContainerElt.style.paddingLeft = clEditorLayoutSvc.editorLeftOverflow + 'px';
				editorContainerElt.style.left = -clEditorLayoutSvc.editorLeftOverflow + 'px';

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
					clEditorLayoutSvc.pageY = clEditorLayoutSvc.isMenuOpen ? -50 : 0;
					clEditorLayoutSvc.pageRotate = clEditorLayoutSvc.isMenuOpen ? -2 : 0;
					scope.showHelp = clSettingSvc.values.editorHelpBtn && clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isSidePreviewOpen && !scope.currentFileDao.isReadOnly;
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
					editorContentElt.style.paddingBottom = document.body.clientHeight / 2 + 'px';
					var previewScrollbarWidth = previewContainerElt.offsetWidth - previewContainerElt.clientWidth;
					var eltToScroll = clEditorSvc.editorElt.parentNode,
						dimensionKey = 'editorDimension';
					if (!clEditorLayoutSvc.isEditorOpen) {
						eltToScroll = clEditorSvc.previewElt.parentNode, dimensionKey = 'previewDimension';
					}
					var scrollTop = eltToScroll.scrollTop;
					var scrollSectionDesc, posInSection;
					sectionDescList === clEditorSvc.sectionDescList && sectionDescList.cl_some(function(sectionDesc) {
						if (scrollTop < sectionDesc[dimensionKey].endOffset) {
							scrollSectionDesc = sectionDesc;
							posInSection = (scrollTop - sectionDesc[dimensionKey].startOffset) / (sectionDesc[dimensionKey].height || 1);
							return true;
						}
					});

					clEditorLayoutSvc.fontSizePx = clEditorLayoutSvc.fontSize + 'px';
					clEditorLayoutSvc.fontSizeEm = (7 + clLocalSettingSvc.values.editorZoom) / 10 + 'em';
					binderPanelElt.clanim
						.width(clEditorLayoutSvc.binderWidth)
						.left(-clEditorLayoutSvc.binderWidth / 2)
						.start();
					previewPanelElt.clanim
						.width(clEditorLayoutSvc.previewWidth)
						.left(-clEditorLayoutSvc.previewWidth / 2)
						.start();
					headerPanelElt.clanim
						.width(clEditorLayoutSvc.previewHeaderWidth - previewScrollbarWidth)
						.start();
					var pagePanelWidth = clEditorLayoutSvc.binderWidth - clEditorLayoutSvc.pageMarginLeft - clEditorLayoutSvc.pageMarginRight;
					pagePanelElt.clanim
						.width(pagePanelWidth)
						.start();
					editorContainerElt.clanim
						.width(pagePanelWidth + clEditorLayoutSvc.editorLeftOverflow)
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
					backgroundPanelElt.clanim
						.translateX(clEditorLayoutSvc.backgroundX)
						.duration(isInited && 300)
						.easing('materialOut')
						.start();
					binderPanelElt.clanim
						.translateX(clEditorLayoutSvc.binderX)
						.duration(isInited && 300)
						.easing('materialOut')
						.start();
					previewPanelElt.clanim
						.translateX(clEditorLayoutSvc.previewX)
						.duration(isInited && 300)
						.easing('materialOut')
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
					editorPanelElt.clanim
						.translateX(clEditorLayoutSvc.editorX)
						.translateY(clEditorLayoutSvc.editorY)
						.duration(isInited && 300)
						.easing(clEditorLayoutSvc.isEditorOpen ? 'materialOut' : 'materialIn')
						.start(true);
					setTimeout(function() {
						hidePreview();
						clEditorLayoutSvc.toggleSidePreview(false);
						clEditorLayoutSvc.currentControl = undefined;
						isInited && scope.$apply();
					}, 500);
				}

				function animateMenu() {
					updateLayout();
					pagePanelElt.clanim
						.translateX(clEditorLayoutSvc.pageX)
						.translateY(clEditorLayoutSvc.pageY)
						.rotate(clEditorLayoutSvc.pageRotate)
						.duration(200)
						.easing('materialOut')
						.start(true);
					editorPanelElt.clanim
						.translateX(clEditorLayoutSvc.editorX)
						.translateY(clEditorLayoutSvc.editorY)
						.duration(isInited && 200)
						.easing('materialOut')
						.start(true);
				}

				function animateCornerFolding() {
					if (!clEditorLayoutSvc.isCornerFoldingOpen) {
						clEditorLayoutSvc.isCornerFoldingVisible = false;
					}
					cornerFoldingElt.clanim
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
					headerBtnGrpElt.clanim
						.duration(isInited && 200)
						.rotate(isPreviewTop ? 0 : 90)
						.start(true);
					closeButtonElt.clanim
						.zIndex(isPreviewTop ? 0 : -1)
						.opacity(isPreviewTop ? 1 : 0)
						.duration(isInited && 200)
						.easing('materialOut')
						.start(true);
					scrollButtonElt.clanim
						.zIndex(isPreviewTop ? -1 : 0)
						.opacity(isPreviewTop ? 0 : 1)
						.duration(isInited && 200)
						.easing('materialOut')
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
					scope.unloadCurrentFile();
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
				scope.$watch('editorLayoutSvc.fontSizePx', function(fontSize) {
					editorContainerElt.style.fontSize = fontSize;
				});
			}
		})
	.factory('clEditorLayoutSvc',
		function($window, $rootScope, clLocalSettingSvc) {
			var clEditorLayoutSvc = {
				pageMarginLeft: 4,
				pageMarginRight: 6,
				editorBtnGrpWidth: 33,
				menuWidth: 320,
				sideBarWidth: 280,
				editorLeftOverflow: 1000, // Allows scrolling on the left outside of the editor
				init: function(hideEditor) {
					this.isEditorOpen = !hideEditor;
					this.isSidePreviewOpen = false;
					this.sideBarTab = 'sample';
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
