angular.module('classeur.core.explorerLayout', [])
	.directive('clFolderButton', function(clExplorerLayoutSvc, clPanel) {
		return {
			restrict: 'A',
			scope: true,
			link: function(scope, element, attr) {
				var elt = element[0];
				var parentElt = elt.parentNode;
				var buttonPanel = clPanel(element);
				var speed;
				var isOpen;
				if (attr.folder) {
					scope.folderDao = scope.$eval(attr.folder);
				}

				function animate() {
					element.toggleClass('open', isOpen);
					var y = scope.$index !== undefined ? 129 + scope.$index * 109 : 0;
					var z = isOpen && (!scope.folderDao || !scope.folderDao.isDraggingTarget) ? 10000 : (scope.$index !== undefined ? scope.explorerLayoutSvc.folders.length - scope.$index : 9997);
					buttonPanel.css('z-index', z).$elt.offsetWidth; // Force z-offset to refresh before the animation
					buttonPanel.move(speed).translate(isOpen ? 0 : -5, y).ease('out').then(function() {
						if (isOpen) {
							// Adjust scrolling position
							var minY = parentElt.scrollTop + 160;
							var maxY = parentElt.scrollTop + parentElt.clientHeight - 240;
							if (y > maxY) {
								parentElt.scrollTop += y - maxY;
							}
							if (y < minY) {
								parentElt.scrollTop += y - minY;
							}
						}
					}).end();
					speed = 'fast';
				}

				scope.$watch('$index', animate);
				scope.$watch('explorerLayoutSvc.currentFolderDao === folderDao', function(isSelected) {
					element.toggleClass('selected', isSelected);
					if (isSelected) {
						clExplorerLayoutSvc.currentFolderButtonElt = scope.$index !== undefined && element[0];
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
	.directive('clExplorerLayout', function($window, $timeout, $mdDialog, clUserSvc, clExplorerLayoutSvc, clDocFileSvc, clFileSvc, clFolderSvc, clClasseurSvc, clPanel, clToast, clConstants, clSyncSvc, clSettingSvc, clScrollBarWidth) {
		var explorerMaxWidth = 740;
		var noPaddingWidth = 560;
		var hideOffsetY = 2000;
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/explorerLayout.html',
			link: function(scope, element) {

				var explorerPanel = clPanel(element, '.explorer.container');
				var contentPanel = clPanel(element, '.explorer.content');
				var scrollbarPanel = clPanel(element, '.scrollbar.panel');

				var folderContentElt = element[0].querySelector('md-content');
				var tabContainerElt = element[0].querySelector('.btn-grp .container');
				var btnGroupElt = angular.element(element[0].querySelector('.btn-grp'));
				var scrollerElt = btnGroupElt[0].querySelector('.container');
				var createFolderButtonElt = btnGroupElt[0].querySelector('.create.folder.btn');
				clExplorerLayoutSvc.toggleHiddenBtn = function() {
					btnGroupElt.toggleClass('hidden-btn', !!clExplorerLayoutSvc.currentFolderButtonElt &&
						clExplorerLayoutSvc.currentFolderButtonElt.getBoundingClientRect().top < createFolderButtonElt.getBoundingClientRect().bottom - 1);
				};

				scrollerElt.addEventListener('scroll', clExplorerLayoutSvc.toggleHiddenBtn);

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
					explorerPanel.$jqElt.toggleClass('no-padding', clExplorerLayoutSvc.noPadding);
					contentPanel
						.move(isInited && 'sslow').y(clExplorerLayoutSvc.contentY).ease(clExplorerLayoutSvc.isExplorerOpen ? 'out' : 'in').end();
					scrollbarPanel.width(clExplorerLayoutSvc.explorerWidth + 50 - clScrollBarWidth);
					isInited = true;
				}

				window.addEventListener('resize', animateLayout);
				scope.$on('$destroy', function() {
					window.removeEventListener('resize', animateLayout);
				});

				function setPlasticClass() {
					var index = 0;
					if (clExplorerLayoutSvc.currentFolderDao) {
						if (clExplorerLayoutSvc.currentFolderDao === clExplorerLayoutSvc.unclassifiedFolder) {
							index = 1;
						} else {
							index = clExplorerLayoutSvc.folders.indexOf(clExplorerLayoutSvc.currentFolderDao) + 3;
						}
					}
					scope.plasticClass = 'plastic-' + (index % 4);
				}

				scope.folderNameModified = function() {
					clExplorerLayoutSvc.currentFolderDao.name = clExplorerLayoutSvc.currentFolderDao.name || 'Untitled';
					clExplorerLayoutSvc.refreshFolders();
					setPlasticClass();
				};

				function makeInputDialog(templateUrl, onComplete) {
					return $mdDialog.show({
						templateUrl: templateUrl,
						onComplete: function(scope, element) {
							scope.ok = function() {
								if (!scope.value) {
									return scope.inputFocus();
								}
								$mdDialog.hide(scope.value);
							};
							scope.cancel = function() {
								$mdDialog.cancel();
							};
							var inputElt = element[0].querySelector('input');
							inputElt.addEventListener('keydown', function(e) {
								// Check enter key
								if (e.which === 13) {
									e.preventDefault();
									scope.ok();
								}
							});
							scope.inputFocus = function() {
								setTimeout(function() {
									inputElt.focus();
								}, 10);
							};
							scope.inputFocus();
							onComplete && onComplete(scope, element);
						}
					});
				}

				function importExistingFolder(folderDao) {
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

				function importFolder() {
					makeInputDialog('core/explorerLayout/importFolderDialog.html')
						.then(function(link) {
							var components = link.split('/');
							var folderId = components[components.length - 1];
							var userId = components[components.length - 3];
							if (!folderId || !userId || link.indexOf(clConstants.serverUrl) !== 0) {
								clToast('Invalid folder link.');
							}
							if (clExplorerLayoutSvc.currentClasseurDao.folders.some(function(folderDao) {
									return folderDao.id === folderId;
								})) {
								clToast('Folder is already in the classeur.');
							}
							var folderDao = clFolderSvc.folderMap[folderId];
							folderDao ? importExistingFolder(folderDao) : importPublicFolder(userId, folderId);
						});
				}

				function createFolder() {
					makeInputDialog('core/explorerLayout/newFolderDialog.html', function(scope) {
						scope.import = function() {
							$mdDialog.cancel();
							importFolder();
						};
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
					makeInputDialog('core/explorerLayout/newFileDialog.html')
						.then(function(name) {
							var newFileDao = clFileSvc.createFile();
							newFileDao.state = 'loaded';
							newFileDao.readContent();
							newFileDao.name = name;
							newFileDao.contentDao.properties = clSettingSvc.settings.values.defaultFileProperties || {};
							newFileDao.writeContent();
							if (clExplorerLayoutSvc.currentFolderDao) {
								newFileDao.folderId = clExplorerLayoutSvc.currentFolderDao.id;
							}
							scope.setCurrentFile(newFileDao);
						});
				};

				// setInterval(function() {
				// 	var fileDao = clFileSvc.createFile();
				// 	fileDao.name = 'File ' + fileDao.id;
				// 	fileDao.folderId = clFolderSvc.folders[Math.random() * clFolderSvc.folders.length | 0].id;
				// 	scope.$apply();
				// }, 1000);

				// setInterval(function() {
				// 	var folderDao = clFolderSvc.createFolder();
				// 	folderDao.name = 'Folder ' + folderDao.id;
				// 	clExplorerLayoutSvc.currentClasseurDao.folders.push(folderDao);
				// 	scope.$apply();
				// }, 15000);

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
					clExplorerLayoutSvc.updateSelectedFiles(); // updateSelectedFiles is called automatically but later
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
							.content('You\'re about to delete ' + filesToRemove.length + ' file(s). Are you sure?')
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
					makeInputDialog('core/explorerLayout/newClasseurDialog.html')
						.then(function(name) {
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
					tabContainerElt.scrollTop = 0;
					clExplorerLayoutSvc.setCurrentClasseur(classeurDao);
					clExplorerLayoutSvc.setCurrentFolder(classeurDao.lastFolder);
					clExplorerLayoutSvc.refreshFolders();
					clExplorerLayoutSvc.toggleExplorer(true);
				};

				scope.signout = function() {
					clUserSvc.signout();
					clExplorerLayoutSvc.toggleExplorer(true);
				};

				function refreshFiles() {
					clExplorerLayoutSvc.moreFiles(true);
					clExplorerLayoutSvc.refreshFiles();
					scope.selectNone();
					folderContentElt.scrollTop = 0;
				}

				scope.$watch('explorerLayoutSvc.isExplorerOpen', animateLayout);
				scope.$watch('fileSvc.files', clExplorerLayoutSvc.refreshFiles);
				scope.$watch('folderSvc.folders', function() {
					clClasseurSvc.init();
					clExplorerLayoutSvc.refreshFolders();
				});
				scope.$watch('classeurSvc.classeurs.length', clExplorerLayoutSvc.refreshFolders);
				scope.$watch('explorerLayoutSvc.currentFolderDao', function(folderDao) {
					scope.fileFilter = undefined;
					refreshFiles();
					setPlasticClass();
					clSyncSvc.getExtFolder(folderDao);
				});
				scope.$watch('fileFilter', function(value) {
					clExplorerLayoutSvc.setFileFilter(value);
					refreshFiles();
				});
				scope.$watch('explorerLayoutSvc.files', scope.triggerInfiniteScroll);
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
	.factory('clExplorerLayoutSvc', function($rootScope, clLocalStorage, clFolderSvc, clFileSvc, clClasseurSvc, clSyncSvc) {
		var isInited, pageSize = 20;
		var lastClasseurKey = 'lastClasseurId';
		var lastFolderKey = 'lastFolderId';
		var unclassifiedFolder = {
			id: 'unclassified',
			name: 'My files'
		};
		var createFolder = {
			id: 'create',
			name: 'Create folder'
		};

		function refreshFolders() {
			setCurrentClasseur(isInited ? clExplorerLayoutSvc.currentClasseurDao : clClasseurSvc.classeurMap[clLocalStorage[lastClasseurKey]]);
			clExplorerLayoutSvc.folders = clExplorerLayoutSvc.currentClasseurDao.folders.slice().sort(function(folder1, folder2) {
				return folder1.name.localeCompare(folder2.name);
			});
			setCurrentFolder(isInited ? clExplorerLayoutSvc.currentFolderDao : clFolderSvc.folderMap[clLocalStorage[lastFolderKey]]);
			isInited = true;
		}

		var endFileIndex, fileFilter;

		function moreFiles(reset) {
			if (reset) {
				endFileIndex = 0;
			}
			if (endFileIndex < clExplorerLayoutSvc.files.length) {
				endFileIndex += pageSize;
				clExplorerLayoutSvc.pagedFiles = clExplorerLayoutSvc.files.slice(0, endFileIndex);
				return true;
			}
		}

		function filterFile(fileDao) {
			return !fileFilter || fileDao.name.toLowerCase().indexOf(fileFilter) !== -1;
		}

		function refreshFiles() {
			clExplorerLayoutSvc.files = clExplorerLayoutSvc.currentFolderDao ? clFileSvc.files.filter(
				clExplorerLayoutSvc.currentFolderDao === unclassifiedFolder ? function(fileDao) {
					return !fileDao.userId && filterFile(fileDao);
				} : function(fileDao) {
					return fileDao.folderId === clExplorerLayoutSvc.currentFolderDao.id && filterFile(fileDao);
				}).sort(function(fileDao1, fileDao2) {
				return fileDao1.name.localeCompare(fileDao2.name);
			}) : clFileSvc.localFiles.filter(filterFile).sort(function(fileDao1, fileDao2) {
				return fileDao2.contentDao.lastChange - fileDao1.contentDao.lastChange;
			});
			clExplorerLayoutSvc.pagedFiles = clExplorerLayoutSvc.files.slice(0, endFileIndex);
			setEffectiveSharing();
		}

		function setFileFilter(value) {
			if (fileFilter !== value) {
				fileFilter = value && value.toLowerCase();
				refreshFiles();
			}
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
			clLocalStorage.setItem(lastClasseurKey, classeurDao.id);
		}

		function setCurrentFolder(folderDao) {
			folderDao = folderDao === unclassifiedFolder ? folderDao : (folderDao && clFolderSvc.folderMap[folderDao.id]);
			if (folderDao && folderDao !== unclassifiedFolder && clExplorerLayoutSvc.currentClasseurDao.folders.indexOf(folderDao) === -1) {
				folderDao = undefined;
			}
			clExplorerLayoutSvc.currentFolderDao = folderDao;
			clExplorerLayoutSvc.currentClasseurDao.lastFolder = folderDao;
			folderDao && folderDao.id ? clLocalStorage.setItem(lastFolderKey, folderDao.id) : clLocalStorage.removeItem(lastFolderKey);
			(!folderDao || folderDao === unclassifiedFolder) && clSyncSvc.getExtFilesMetadata();
		}

		var clExplorerLayoutSvc = {
			folders: [],
			files: [],
			unclassifiedFolder: unclassifiedFolder,
			createFolder: createFolder,
			refreshFolders: refreshFolders,
			refreshFiles: refreshFiles,
			moreFiles: moreFiles,
			setFileFilter: setFileFilter,
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
		moreFiles(true);

		return clExplorerLayoutSvc;
	});
