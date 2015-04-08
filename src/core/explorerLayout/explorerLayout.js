angular.module('classeur.core.explorerLayout', [])
	.directive('clFolderButton', function(clExplorerLayoutSvc, clPanel) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				var elt = element[0];
				var parentElt = elt.parentNode;
				var buttonPanel = clPanel(element);
				var speed;
				var isOpen;

				function animate() {
					element.toggleClass('open', isOpen);
					var y = 129 + scope.$index * 109;
					var z = isOpen ? 10000 : (scope.folderDao ? scope.explorerLayoutSvc.folders.length - scope.$index : 9998);
					buttonPanel.css('z-index', z).$elt.offsetWidth; // Force z-offset to refresh before the animation
					buttonPanel.move(speed).translate(isOpen ? 0 : -4, y).ease('out').then(function() {
						if (isOpen) {
							// Adjust scrolling position
							var maxY = parentElt.scrollTop + parentElt.clientHeight - 240;
							if (y > maxY) {
								parentElt.scrollTop += y - maxY;
							}
						}
					}).end();
					speed = 'fast';
				}

				scope.$watch('$index', animate);
				scope.$watch('explorerLayoutSvc.currentFolderDao === folderDao', function(isSelected) {
					element.toggleClass('selected', isSelected);
					if (isSelected) {
						clExplorerLayoutSvc.currentFolderButtonElt = scope.folderDao && element[0];
						clExplorerLayoutSvc.toggleHiddenBtn();
					}
				});
				scope.$watch('explorerLayoutSvc.currentFolderDao === folderDao || folderDao.isDraggingTarget', function(value) {
					isOpen = value;
					animate();
				});
			}
		};
	})
	.directive('clFileEntry', function(clExplorerLayoutSvc) {
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/fileEntry.html',
			link: function(scope, element) {
				var nameInput = element[0].querySelector('input.name');
				nameInput.addEventListener('keydown', function(e) {
					if (e.which === 27 || e.which === 13) {
						// Esc key
						nameInput.blur();
					}
				});
				scope.open = function() {
					!scope.isEditing && scope.setCurrentFile(scope.fileDao);
				};
				scope.setEditing = function(value) {
					scope.isEditing = value;
					if (value) {
						setTimeout(function() {
							nameInput.focus();
						}, 10);
					} else {
						clExplorerLayoutSvc.refreshFiles();
					}
				};
			}
		};
	})
	.directive('clFolderName', function() {
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/folderName.html',
			link: function(scope, element) {
				var nameInput = element[0].querySelector('input.name');
				nameInput.addEventListener('keydown', function(e) {
					if (e.which === 27 || e.which === 13) {
						// Esc key
						nameInput.blur();
					}
				});
				scope.setEditing = function(value) {
					scope.isEditing = value;
					if (value) {
						setTimeout(function() {
							nameInput.focus();
						}, 10);
					} else {
						scope.folderNameModified();
					}
				};
			}
		};
	})
	.directive('clClasseurEntry', function(clClasseurSvc) {
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/classeurEntry.html',
			link: function(scope, element) {
				var nameInput = element[0].querySelector('.name textarea');
				nameInput.addEventListener('keydown', function(e) {
					if (e.which === 27 || e.which === 13) {
						// Esc key
						nameInput.blur();
					}
				});
				scope.open = function() {
					!scope.isEditing && scope.setClasseur(scope.classeur);
				};
				scope.setEditing = function(value) {
					scope.isEditing = value;
					if (value) {
						setTimeout(function() {
							nameInput.focus();
						}, 10);
					} else {
						scope.classeur.name = scope.classeur.name || 'Untitled';
						clClasseurSvc.init();
					}
				};
				element[0].querySelector('.footer.panel').addEventListener('click', function(evt) {
					evt.stopPropagation();
				});
			}
		};
	})
	.directive('clExplorerLayout', function($window, $timeout, $mdDialog, clExplorerLayoutSvc, clDocFileSvc, clFileSvc, clFolderSvc, clClasseurSvc, clPanel, clToast, clConstants, clSyncSvc, clScrollBarWidth) {
		var explorerMaxWidth = 740;
		var noPaddingWidth = 560;
		var hideOffsetY = 2000;
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/explorerLayout.html',
			link: function(scope, element) {

				var explorerPanel = clPanel(element, '.explorer.container');
				var contentPanel = clPanel(element, '.explorer.content');
				var toggleIconPanel = clPanel(element, '.toggle.icon');
				var scrollbarPanel = clPanel(element, '.scrollbar.panel');

				var folderContentElt = element[0].querySelector('md-content');
				var btnGroupElt = angular.element(element[0].querySelector('.btn-grp'));
				var scrollerElt = btnGroupElt[0].querySelector('.container');
				var recentButtonElt = btnGroupElt[0].querySelector('.recent.btn');
				clExplorerLayoutSvc.toggleHiddenBtn = function() {
					btnGroupElt.toggleClass('hidden-btn', !!clExplorerLayoutSvc.currentFolderButtonElt &&
						clExplorerLayoutSvc.currentFolderButtonElt.getBoundingClientRect().top < recentButtonElt.getBoundingClientRect().bottom - 1);
				};

				scrollerElt.addEventListener('scroll', clExplorerLayoutSvc.toggleHiddenBtn);

				element[0].querySelector('.new.tile .footer.panel').addEventListener('click', function(evt) {
					evt.stopPropagation();
				});

				function updateLayout() {
					var explorerWidth = document.body.clientWidth;
					if (explorerWidth > explorerMaxWidth) {
						explorerWidth = explorerMaxWidth;
					}
					clExplorerLayoutSvc.explorerWidth = explorerWidth;
					clExplorerLayoutSvc.noPadding = explorerWidth < noPaddingWidth;
					clExplorerLayoutSvc.contentY = clExplorerLayoutSvc.isExplorerOpen ? 0 : hideOffsetY;
				}

				var isInited;

				function animateLayout() {
					updateLayout();
					explorerPanel
						.width(clExplorerLayoutSvc.explorerWidth)
						.move().x(-clExplorerLayoutSvc.explorerWidth / 2 - 44).end();
					contentPanel
						.move(isInited && 'sslow').y(clExplorerLayoutSvc.contentY).ease(clExplorerLayoutSvc.isExplorerOpen ? 'out' : 'in').end();
					contentPanel.$jqElt.toggleClass('no-padding', clExplorerLayoutSvc.noPadding);
					scrollbarPanel.width(clExplorerLayoutSvc.explorerWidth + 50 - clScrollBarWidth);
					toggleIconPanel.css().move(isInited && 'sslow').rotate(clExplorerLayoutSvc.isExplorerOpen ? 0 : -90).end();
					isInited = true;
				}

				window.addEventListener('resize', animateLayout);
				scope.$on('$destroy', function() {
					window.removeEventListener('resize', animateLayout);
				});

				function setPlasticClass() {
					scope.plasticClass = 'plastic';
					if (clExplorerLayoutSvc.currentFolderDao) {
						var index = clExplorerLayoutSvc.folders.indexOf(clExplorerLayoutSvc.currentFolderDao);
						scope.plasticClass = 'plastic-' + ((index + 1) % 4);
					}
				}

				scope.folderNameModified = function() {
					clExplorerLayoutSvc.currentFolderDao.name = clExplorerLayoutSvc.currentFolderDao.name || 'Untitled';
					clExplorerLayoutSvc.refreshFolders();
					setPlasticClass();
				};

				function onCompleteNameFocus(cb) {
					return function(scope, element) {
						scope.ok = function() {
							if (!scope.name) {
								return scope.nameFocus();
							}
							$mdDialog.hide(scope.name);
						};
						scope.cancel = function() {
							$mdDialog.cancel();
						};
						var inputElt = element[0].querySelector('input.name');
						inputElt.addEventListener('keydown', function(e) {
							// Check enter key
							if (e.which === 13) {
								e.preventDefault();
								scope.ok();
							}
						});
						scope.nameFocus = function() {
							setTimeout(function() {
								inputElt.focus();
							}, 10);
						};
						scope.nameFocus();
						cb && cb(scope, element);
					};
				}

				function createFolder() {
					$mdDialog.show({
						templateUrl: 'core/explorerLayout/newFolderDialog.html',
						onComplete: onCompleteNameFocus(function(scope, element) {
							var namePanel = clPanel(element, '.name.panel');
							var linkPanel = clPanel(element, '.link.panel');
							var currentPanel = 'name';

							function animate() {
								namePanel.move('fast').set('height', currentPanel === 'name' ? '70px' : 0).end();
								linkPanel.move('fast').set('height', currentPanel === 'link' ? '70px' : 0).end();
							}

							function importFolder(folderDao) {
								clExplorerLayoutSvc.currentClasseurDao.folders.push(folderDao);
								clClasseurSvc.init();
								clExplorerLayoutSvc.refreshFolders();
								clExplorerLayoutSvc.setCurrentFolder(folderDao);
								$mdDialog.cancel();
							}

							function importPublicFolder(userId, folderId) {
								var folderDao = clFolderSvc.createPublicFolder(userId, folderId);
								folderDao.removeOnFailure = true;
								// Classeurs are updated when evaluating folderSvc.folders
								clExplorerLayoutSvc.currentClasseurDao.folders.push(folderDao);
								$timeout(function() {
									clExplorerLayoutSvc.setCurrentFolder(folderDao);
								});
								$mdDialog.cancel();
							}

							var ok = scope.ok;
							scope.ok = function() {
								if (currentPanel !== 'name') {
									currentPanel = 'name';
									animate();
									return scope.nameFocus();
								}
								ok();
							};

							scope.import = function() {
								if (currentPanel !== 'link') {
									currentPanel = 'link';
									animate();
									return scope.linkFocus();
								}
								if (!scope.link) {
									return scope.linkFocus();
								}
								var components = scope.link.split('/');
								var folderId = components[components.length - 1];
								var userId = components[components.length - 3];
								if (!folderId || !userId || scope.link.indexOf(clConstants.serverUrl) !== 0) {
									clToast('Invalid folder link.');
									return scope.linkFocus();
								}
								if (clExplorerLayoutSvc.currentClasseurDao.folders.some(function(folderDao) {
										return folderDao.id === folderId;
									})) {
									clToast('Folder is already in this classeur.');
									return $mdDialog.cancel();
								}
								var folderDao = clFolderSvc.folderMap[folderId];
								folderDao ? importFolder(folderDao) : importPublicFolder(userId, folderId);
							};
							var inputElt = element[0].querySelector('input.link');
							inputElt.addEventListener('keydown', function(e) {
								// Check enter key
								if (e.which === 13) {
									e.preventDefault();
									scope.import();
								}
							});
							scope.linkFocus = function() {
								setTimeout(function() {
									inputElt.focus();
								}, 10);
							};

						})
					}).then(function(name) {
						var folderDao = clFolderSvc.createFolder();
						folderDao.name = name;
						// Classeurs are updated when evaluating folderSvc.folders
						clExplorerLayoutSvc.currentClasseurDao.folders.push(folderDao);
						$timeout(function() {
							clExplorerLayoutSvc.setCurrentFolder(folderDao);
						});
					});
				}

				scope.createFile = function() {
					$mdDialog.show({
						templateUrl: 'core/explorerLayout/newFileDialog.html',
						onComplete: onCompleteNameFocus()
					}).then(function(name) {
						var fileDao = clFileSvc.createFile();
						fileDao.name = name;
						if (clExplorerLayoutSvc.currentFolderDao) {
							fileDao.folderId = clExplorerLayoutSvc.currentFolderDao.id;
						}
						scope.setCurrentFile(fileDao);
						clExplorerLayoutSvc.refreshFiles();
					});
				};

				// setInterval(function() {
				// 		var fileDao = clFileSvc.createFile();
				// 		fileDao.name = 'File ' + fileDao.id;
				// 		clExplorerLayoutSvc.refreshFiles();
				// }, 2000);

				scope.setFolder = function(folder) {
					if (folder === clExplorerLayoutSvc.createFolder) {
						return createFolder();
					}
					clExplorerLayoutSvc.setCurrentFolder(folder);
				};

				scope.selectAll = function() {
					clExplorerLayoutSvc.files.forEach(function(fileDao) {
						fileDao.isSelected = true;
					});
				};

				scope.selectNone = function() {
					clExplorerLayoutSvc.files.forEach(function(fileDao) {
						fileDao.isSelected = false;
					});
				};

				scope.deleteConfirm = function(deleteFolder) {
					deleteFolder && scope.selectAll();
					var filesToRemove = clExplorerLayoutSvc.selectedFiles;

					function remove() {
						clFileSvc.removeFiles(filesToRemove);
						if (deleteFolder && clFolderSvc.removeFolder(clExplorerLayoutSvc.currentFolderDao) >= 0) {
							var newIndex = clExplorerLayoutSvc.folders.indexOf(clExplorerLayoutSvc.currentFolderDao) - 1;
							var currentFolderDao = clExplorerLayoutSvc.folders[newIndex] || clExplorerLayoutSvc.unclassifiedFolder;
							clExplorerLayoutSvc.setCurrentFolder(currentFolderDao);
						}
					}

					function deleteConfirm() {
						if (!filesToRemove.length) {
							// No confirmation
							return remove();
						}
						var title = 'Delete files';
						var confirm = $mdDialog.confirm()
							.title(title)
							.ariaLabel(title)
							.content('You\'re about to delete ' + filesToRemove.length + ' file(s). Are you sure')
							.ok('Yes')
							.cancel('No');
						$mdDialog.show(confirm).then(remove);
					}

					if (deleteFolder) {
						var folderDao = clExplorerLayoutSvc.currentFolderDao;
						if (clClasseurSvc.classeurs.some(function(classeurDao) {
								if (classeurDao !== clExplorerLayoutSvc.currentClasseurDao && classeurDao.folders.indexOf(folderDao) !== -1) {
									return true;
								}
							})) {
							var title = 'Delete folder';
							var confirm = $mdDialog.confirm()
								.title(title)
								.ariaLabel(title)
								.content('Do you want to remove the folder from all classeurs?')
								.ok('This only')
								.cancel('All');
							return $mdDialog.show(confirm).then(function() {
								clExplorerLayoutSvc.currentClasseurDao.folders = clExplorerLayoutSvc.currentClasseurDao.folders.filter(function(folderInClasseur) {
									return folderInClasseur.id !== folderDao.id;
								});
								clClasseurSvc.init();
								clExplorerLayoutSvc.refreshFolders();
							}, deleteConfirm);
						}
					}
					deleteConfirm();
				};

				scope.createClasseur = function() {
					$mdDialog.show({
						templateUrl: 'core/explorerLayout/newClasseurDialog.html',
						onComplete: onCompleteNameFocus()
					}).then(function(name) {
						var classeurDao = clClasseurSvc.createClasseur(name);
						scope.setClasseur(classeurDao);
					});
				};

				scope.deleteClasseur = function(classeurDao) {
					var filesToRemove = [];
					var foldersToRemove = classeurDao.folders.filter(function(folderDao) {
						if (!clClasseurSvc.classeurs.some(function(otherClasseurDao) {
								return otherClasseurDao !== classeurDao && otherClasseurDao.folders.indexOf(folderDao) !== -1;
							})) {
							filesToRemove = filesToRemove.concat(clExplorerLayoutSvc.files.filter(function(fileDao) {
								return fileDao.folderId === folderDao.id;
							}));
							return true;
						}
					});

					function remove() {
						clClasseurSvc.removeClasseur(classeurDao);
					}

					if (!foldersToRemove.length) {
						return remove();
					}

					$mdDialog.show({
						templateUrl: 'core/explorerLayout/deleteClasseurDialog.html',
						onComplete: function(scope) {
							scope.remove = function() {
								clFileSvc.removeFiles(filesToRemove);
								clFolderSvc.removeFolders(foldersToRemove);
								$mdDialog.hide();
							};
							scope.move = function() {
								$mdDialog.hide();
							};
							scope.cancel = function() {
								$mdDialog.cancel();
							};
						}
					}).then(remove);
				};

				scope.setClasseur = function(classeurDao) {
					clExplorerLayoutSvc.setCurrentClasseur(classeurDao);
					clExplorerLayoutSvc.refreshFolders();
					clExplorerLayoutSvc.toggleExplorer(true);
				};

				scope.$watch('explorerLayoutSvc.isExplorerOpen', animateLayout);
				scope.$watch('fileSvc.files', clExplorerLayoutSvc.refreshFiles);
				scope.$watch('folderSvc.folders', function() {
					clClasseurSvc.init();
					clExplorerLayoutSvc.refreshFolders();
				});
				scope.$watch('classeurSvc.classeurs.length', clExplorerLayoutSvc.refreshFolders);
				scope.$watch('explorerLayoutSvc.currentFolderDao', function(folderDao) {
					clExplorerLayoutSvc.refreshFiles();
					scope.selectNone();
					setPlasticClass();
					clSyncSvc.getExtFolder(folderDao);
					folderContentElt.scrollTop = 0;
				});
				scope.$watch('explorerLayoutSvc.currentClasseurDao', setPlasticClass);
				scope.$watch('explorerLayoutSvc.currentFolderDao.sharing', clExplorerLayoutSvc.setEffectiveSharing);

				// Refresh selectedFiles on every digest and add 1 cycle when length changes
				scope.$watch('explorerLayoutSvc.updateSelectedFiles().length', function() {});

				scope.$on('$destroy', function() {
					clExplorerLayoutSvc.clean();
				});
			}
		};
	})
	.factory('clExplorerLayoutSvc', function($rootScope, clFolderSvc, clFileSvc, clClasseurSvc, clSyncSvc) {
		var isInited;
		var lastClasseurKey = 'lastClasseurId';
		var lastFolderKey = 'lastFolderId';
		var unclassifiedFolder = {
			name: 'Unclassified'
		};
		var createFolder = {
			name: 'Create folder'
		};

		function refreshFolders() {
			setCurrentClasseur(isInited ? clExplorerLayoutSvc.currentClasseurDao : clClasseurSvc.classeurMap[localStorage[lastClasseurKey]]);
			clExplorerLayoutSvc.folders = clExplorerLayoutSvc.currentClasseurDao.folders.slice().sort(function(folder1, folder2) {
				return folder1.name.toLowerCase() > folder2.name.toLowerCase();
			});
			clExplorerLayoutSvc.folders.unshift(unclassifiedFolder);
			clExplorerLayoutSvc.folders.push(createFolder);
			setCurrentFolder(isInited ? clExplorerLayoutSvc.currentFolderDao : clFolderSvc.folderMap[localStorage[lastFolderKey]]);
			isInited = true;
		}

		function refreshFiles() {
			clExplorerLayoutSvc.files = clExplorerLayoutSvc.currentFolderDao ? clFileSvc.files.filter(
				clExplorerLayoutSvc.currentFolderDao === unclassifiedFolder ? function(fileDao) {
					return !fileDao.userId && !clFolderSvc.folderMap.hasOwnProperty(fileDao.folderId);
				} : function(fileDao) {
					return fileDao.folderId === clExplorerLayoutSvc.currentFolderDao.id;
				}) : clFileSvc.localFiles.slice();
			setEffectiveSharing();
		}

		function updateSelectedFiles() {
			clExplorerLayoutSvc.selectedFiles = clExplorerLayoutSvc.files.filter(function(fileDao) {
				return fileDao.isSelected;
			});
			return clExplorerLayoutSvc.selectedFiles;
		}

		function setEffectiveSharing() {
			if (clExplorerLayoutSvc.currentFolderDao) {
				clExplorerLayoutSvc.currentFolderDao.effectiveSharing = clExplorerLayoutSvc.currentFolderDao.sharing;
			}
			clExplorerLayoutSvc.files.forEach(function(fileDao) {
				fileDao.effectiveSharing = fileDao.sharing;
				var folderDao = clFolderSvc.folderMap[fileDao.folderId];
				if (folderDao && folderDao.sharing > fileDao.sharing) {
					fileDao.effectiveSharing = folderDao.sharing;
				}
			});
		}

		function setCurrentClasseur(classeurDao) {
			classeurDao = (classeurDao && clClasseurSvc.classeurMap[classeurDao.id]) || clClasseurSvc.defaultClasseur;
			clExplorerLayoutSvc.currentClasseurDao = classeurDao;
			localStorage.setItem(lastClasseurKey, classeurDao.id);
		}

		function setCurrentFolder(folderDao) {
			folderDao = folderDao === unclassifiedFolder ? folderDao : (folderDao && clFolderSvc.folderMap[folderDao.id]);
			if (folderDao && folderDao !== unclassifiedFolder && clExplorerLayoutSvc.currentClasseurDao.folders.indexOf(folderDao) === -1) {
				folderDao = undefined;
			}
			clExplorerLayoutSvc.currentFolderDao = folderDao;
			folderDao && folderDao.id ? localStorage.setItem(lastFolderKey, folderDao.id) : localStorage.removeItem(lastFolderKey);
			(!folderDao || folderDao === unclassifiedFolder) && clSyncSvc.getExtFilesMetadata();
		}

		var clExplorerLayoutSvc = {
			folders: [],
			files: [],
			unclassifiedFolder: unclassifiedFolder,
			createFolder: createFolder,
			refreshFolders: refreshFolders,
			refreshFiles: refreshFiles,
			updateSelectedFiles: updateSelectedFiles,
			setEffectiveSharing: setEffectiveSharing,
			setCurrentClasseur: setCurrentClasseur,
			setCurrentFolder: setCurrentFolder,
			init: function() {
				this.isExplorerOpen = true;
			},
			clean: function() {
				clExplorerLayoutSvc.sharingDialogFileDao = undefined;
			},
			toggleExplorer: function(isOpen) {
				this.isExplorerOpen = isOpen === undefined ? !this.isExplorerOpen : isOpen;
			}
		};

		return clExplorerLayoutSvc;
	});
