angular.module('classeur.core.explorerLayout', [])
	.directive('clFolderButton',
		function(clExplorerLayoutSvc) {
			return {
				restrict: 'A',
				scope: true,
				link: link
			};

			function link(scope, element, attr) {
				var buttonElt = element[0];
				var parentElt = buttonElt.parentNode;
				var duration;
				if (attr.folder) {
					scope.folderDao = scope.$eval(attr.folder);
				}
				var isHover;

				function animate() {
					var isSelected = clExplorerLayoutSvc.currentFolderDao === scope.folderDao;
					element.toggleClass('selected', isSelected);
					var y = scope.$index !== undefined ? 129 + scope.$index * 109 : 0;
					var z = isSelected ? 10000 : (scope.$index !== undefined ? scope.explorerLayoutSvc.folders.length - scope.$index : 9997);
					buttonElt.clanim
						.zIndex(z)
						.start()
						.offsetWidth; // Force z-offset to refresh before the animation
					buttonElt.clanim
						.duration(duration)
						.translateX(isSelected ? 0 : isHover ? -3 : -5)
						.translateY(y)
						.easing('materialOut')
						.start(true);
					duration = 400;
					if (isSelected) {
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
				}

				buttonElt.addEventListener('mouseenter', function() {
					isHover = true;
					animate();
				});
				buttonElt.addEventListener('mouseleave', function() {
					isHover = false;
					animate();
				});

				scope.$watch('$index', animate);
				scope.$watch('explorerLayoutSvc.currentFolderDao === folderDao', function(isSelected) {
					if (isSelected) {
						clExplorerLayoutSvc.currentFolderButtonElt = scope.$index !== undefined && element[0];
						clExplorerLayoutSvc.toggleHiddenBtn();
					}
					animate();
				});
			}
		})
	.directive('clFileEntry',
		function($timeout, clExplorerLayoutSvc) {
			return {
				restrict: 'E',
				templateUrl: 'core/explorerLayout/fileEntry.html',
				link: link
			};

			function link(scope, element) {
				var nameInput = element[0].querySelector('.name input');
				nameInput.addEventListener('keydown', function(e) {
					if (e.which == 27) {
						scope.form.$rollbackViewValue();
						nameInput.blur();
					} else if (e.which === 13) {
						nameInput.blur();
					}
				});
				scope.name = function(name) {
					if (name) {
						scope.fileDao.name = name;
					} else if (!scope.fileDao.name) {
						scope.fileDao.name = 'Untitled';
					}
					return scope.fileDao.name;
				};
				scope.name();
				scope.open = function() {
					!scope.isEditing && scope.setCurrentFile(scope.fileDao);
				};
				var unsetTimeout;
				scope.setEditing = function(value) {
					$timeout.cancel(unsetTimeout);
					if (value) {
						scope.isEditing = true;
						setTimeout(function() {
							nameInput.focus();
						}, 10);
					} else {
						unsetTimeout = $timeout(function() {
							scope.isEditing = false;
							clExplorerLayoutSvc.refreshFiles();
						}, 250);
					}
				};
			}
		})
	.directive('clFolderName',
		function($timeout, clExplorerLayoutSvc) {
			return {
				restrict: 'E',
				templateUrl: 'core/explorerLayout/folderName.html',
				link: link
			};

			function link(scope, element) {
				var nameInput = element[0].querySelector('.name input');
				nameInput.addEventListener('keydown', function(e) {
					if (e.which == 27) {
						scope.form.$rollbackViewValue();
						nameInput.blur();
					} else if (e.which === 13) {
						nameInput.blur();
					}
				});
				scope.name = function(name) {
					if (name) {
						clExplorerLayoutSvc.currentFolderDao.name = name;
					} else if (!clExplorerLayoutSvc.currentFolderDao.name) {
						clExplorerLayoutSvc.currentFolderDao.name = 'Untitled';
					}
					return clExplorerLayoutSvc.currentFolderDao.name;
				};
				scope.name();
				var unsetTimeout;
				scope.setEditing = function(value) {
					$timeout.cancel(unsetTimeout);
					if (value) {
						scope.isEditing = true;
						setTimeout(function() {
							nameInput.focus();
						}, 10);
					} else {
						unsetTimeout = $timeout(function() {
							scope.isEditing = false;
							scope.folderNameModified();
						}, 250);
					}
				};
			}
		})
	.directive('clClasseurEntry',
		function($timeout, clClasseurSvc) {
			return {
				restrict: 'E',
				templateUrl: 'core/explorerLayout/classeurEntry.html',
				link: link
			};

			function link(scope, element) {
				var nameInput = element[0].querySelector('.name textarea');
				nameInput.addEventListener('keydown', function(e) {
					if (e.which == 27) {
						scope.form.$rollbackViewValue();
						nameInput.blur();
					} else if (e.which === 13) {
						nameInput.blur();
					}
				});
				scope.name = function(name) {
					if (name) {
						scope.classeur.name = name;
					} else if (!scope.classeur.name) {
						scope.classeur.name = 'Untitled';
					}
					return scope.classeur.name;
				};
				scope.name();
				scope.open = function() {
					!scope.isEditing && scope.setClasseur(scope.classeur);
				};
				var unsetTimeout;
				scope.setEditing = function(value) {
					$timeout.cancel(unsetTimeout);
					if (value) {
						scope.isEditing = true;
						setTimeout(function() {
							nameInput.focus();
						}, 10);
					} else {
						unsetTimeout = $timeout(function() {
							scope.isEditing = false;
							clClasseurSvc.init();
						}, 250);
					}
				};
				element[0].querySelector('.footer.panel').addEventListener('click', function(evt) {
					evt.stopPropagation();
				});
			}
		})
	.directive('clFileDropInput',
		function(clToast, clDialog) {
			var maxSize = 200000;
			return {
				restrict: 'A',
				link: function(scope, element) {
					function uploadFile(file) {
						var reader = new FileReader();
						reader.onload = function(e) {
							var bytes = new Uint8Array(e.target.result);
							var len = bytes.byteLength;
							if (len === maxSize) {
								return clToast('File is too big.');
							}
							var content = '';
							for (var i = 0; i < len; i++) {
								content += String.fromCharCode(bytes[i]);
							}
							if (content.match(/[\uFFF0-\uFFFF]/)) {
								return clToast('File is not readable.');
							}
							clDialog.hide({
								name: file.name,
								content: content
							});
						};
						var blob = file.slice(0, maxSize);
						reader.readAsArrayBuffer(blob);
					}
					var elt = element[0];
					elt.addEventListener('change', function(evt) {
						var files = evt.target.files;
						files[0] && uploadFile(files[0]);
					});
					elt.addEventListener('dragover', function(evt) {
						evt.stopPropagation();
						evt.preventDefault();
						evt.dataTransfer.dropEffect = 'copy';
					});
					elt.addEventListener('dragover', function(evt) {
						evt.stopPropagation();
						evt.preventDefault();
						evt.dataTransfer.dropEffect = 'copy';
					});
					elt.addEventListener('drop', function(evt) {
						var files = (evt.dataTransfer || evt.target).files;
						if (files[0]) {
							evt.stopPropagation();
							evt.preventDefault();
							uploadFile(files[0]);
						}
					});
				}
			};
		})
	.directive('clExplorerLayout',
		function($window, $timeout, clDialog, clUserSvc, clExplorerLayoutSvc, clFileSvc, clFolderSvc, clClasseurSvc, clToast, clConfig, clPublicSyncSvc, clSettingSvc) {
			var explorerMaxWidth = 760;
			var noPaddingWidth = 580;
			var hideOffsetY = 2000;
			return {
				restrict: 'E',
				templateUrl: 'core/explorerLayout/explorerLayout.html',
				link: link
			};

			function link(scope, element) {

				var containerElt = element[0].querySelector('.explorer.container');
				var contentElt = element[0].querySelector('.explorer.content');
				var scrollbarElt = element[0].querySelector('.scrollbar.panel');
				var folderElt = element[0].querySelector('.folder.container.panel');
				var folderCloneElt = element[0].querySelector('.folder.container.clone');
				var fileMenuElt = element[0].querySelector('.folder.container.panel .file.menu');
				var tabContainerElt = element[0].querySelector('.btn-grp .container');
				var btnGroupElt = element[0].querySelector('.btn-grp');
				var scrollerElt = btnGroupElt.querySelector('.container');
				var createFolderButtonElt = btnGroupElt.querySelector('.create.folder.btn');
				clExplorerLayoutSvc.toggleHiddenBtn = function() {
					btnGroupElt.classList.toggle('hidden-btn', !!clExplorerLayoutSvc.currentFolderButtonElt &&
						clExplorerLayoutSvc.currentFolderButtonElt.getBoundingClientRect().top < createFolderButtonElt.getBoundingClientRect().bottom - 1);
				};


				function toggleHiddenFileMenu() {
					folderCloneElt.classList.toggle('hidden', folderElt.scrollTop < fileMenuElt.offsetTop);
				}

				folderElt.addEventListener('scroll', toggleHiddenFileMenu);
				setTimeout(toggleHiddenFileMenu, 1);

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
					clExplorerLayoutSvc.scrollbarWidth = folderElt.offsetWidth - folderElt.clientWidth;
					updateLayout();
					containerElt.clanim
						.width(clExplorerLayoutSvc.explorerWidth - 50)
						.translateX(-clExplorerLayoutSvc.explorerWidth / 2 + 5)
						.start()
						.classList.toggle('no-padding', clExplorerLayoutSvc.noPadding);
					contentElt.clanim
						.translateY(clExplorerLayoutSvc.contentY)
						.duration(isInited && 300)
						.easing(clExplorerLayoutSvc.isExplorerOpen ? 'materialOut' : 'materialIn')
						.start(true);
					var folderContainerWidth = clExplorerLayoutSvc.explorerWidth + clExplorerLayoutSvc.scrollbarWidth;
					scrollbarElt.clanim
						.width(folderContainerWidth)
						.start();
					folderCloneElt.clanim
						.width(folderContainerWidth)
						.start();
					isInited = true;
				}

				window.addEventListener('resize', animateLayout);
				scope.$on('$destroy', function() {
					window.removeEventListener('resize', animateLayout);
				});

				scope.classeurIndex = 0;

				function setPlasticClass() {
					var index = scope.classeurIndex;
					if (clExplorerLayoutSvc.currentFolderDao) {
						if (clExplorerLayoutSvc.currentFolderDao === clExplorerLayoutSvc.unclassifiedFolder) {
							index++;
						} else {
							index += clExplorerLayoutSvc.folders.indexOf(clExplorerLayoutSvc.currentFolderDao) + 3;
						}
					}
					scope.plasticClass = 'plastic-' + (index % 6);
				}

				scope.folderNameModified = function() {
					clExplorerLayoutSvc.currentFolderDao.name = clExplorerLayoutSvc.currentFolderDao.name || 'Untitled';
					clExplorerLayoutSvc.refreshFolders();
					setPlasticClass();
				};

				function makeInputDialog(templateUrl, controller) {
					return clDialog.show({
						templateUrl: templateUrl,
						focusOnOpen: false,
						controller: ['$scope', function(scope) {
							scope.ok = function() {
								if (!scope.value) {
									return scope.focus();
								}
								clDialog.hide(scope.value);
							};
							scope.cancel = function() {
								clDialog.cancel();
							};
							controller && controller(scope);
						}]
					});
				}

				function importExistingFolder(folderDao, move) {
					move && clClasseurSvc.classeurs.cl_each(function(classeurDao) {
						var index = classeurDao.folders.indexOf(folderDao);
						index !== -1 && classeurDao.folders.splice(index, 1);
					});
					clExplorerLayoutSvc.currentClasseurDao.folders.push(folderDao);
					clClasseurSvc.init();
					clExplorerLayoutSvc.refreshFolders();
					clExplorerLayoutSvc.setCurrentFolder(folderDao);
					clDialog.cancel();
				}

				function importPublicFolder(folderId) {
					var folderDao = clFolderSvc.createPublicFolder(folderId);
					// Classeurs are updated when evaluating folderSvc.folders
					clExplorerLayoutSvc.currentClasseurDao.folders.push(folderDao);
					$timeout(function() {
						clExplorerLayoutSvc.setCurrentFolder(folderDao);
					});
					clDialog.cancel();
				}

				function importFolder() {
					makeInputDialog('core/explorerLayout/importFolderDialog.html', function(scope) {
						var classeurFolders = clExplorerLayoutSvc.currentClasseurDao.folders.cl_reduce(function(classeurFolders, folderDao) {
							return (classeurFolders[folderDao.id] = folderDao, classeurFolders);
						}, {});
						scope.folders = clFolderSvc.folders.cl_filter(function(filterDao) {
							return !filterDao.userId && !classeurFolders.hasOwnProperty(filterDao.id);
						});
						scope.move = true;
						var ok = scope.ok;
						scope.ok = function() {
							if (scope.folderId) {
								var folderDao = clFolderSvc.folderMap[scope.folderId];
								folderDao && importExistingFolder(folderDao, scope.move);
								return clDialog.cancel();
							}
							ok();
						};
					}).then(function(link) {
						var components = link.split('/');
						var folderId = components[components.length - 1];
						if (!folderId || link.indexOf(clConfig.appUri) !== 0) {
							clToast('Invalid folder link.');
						}
						if (clExplorerLayoutSvc.currentClasseurDao.folders.cl_some(function(folderDao) {
								return folderDao.id === folderId;
							})) {
							clToast('Folder is already in the classeur.');
						}
						var folderDao = clFolderSvc.folderMap[folderId];
						folderDao ? importExistingFolder(folderDao) : importPublicFolder(folderId);
					});
				}

				function createFolder() {
					makeInputDialog('core/explorerLayout/newFolderDialog.html', function(scope) {
						scope.import = function() {
							clDialog.cancel();
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

				function importFile() {
					var folderDao = clExplorerLayoutSvc.currentFolderDao;
					clDialog.show({
							templateUrl: 'core/explorerLayout/importFileDialog.html',
							controller: ['$scope', function(scope) {
								scope.cancel = function() {
									clDialog.cancel();
								};
							}]
						})
						.then(function(file) {
							var newFileDao = clFileSvc.createFile();
							newFileDao.state = 'loaded';
							newFileDao.readContent();
							newFileDao.name = file.name;
							newFileDao.contentDao.text = file.content;
							newFileDao.contentDao.properties = clSettingSvc.values.defaultFileProperties || {};
							newFileDao.writeContent();
							if (folderDao && clFolderSvc.folderMap[folderDao.id]) {
								newFileDao.folderId = folderDao.id;
								newFileDao.userId = folderDao.userId;
							}
							scope.setCurrentFile(newFileDao);
						});
				}

				scope.createFile = function() {
					var folderDao = clExplorerLayoutSvc.currentFolderDao;
					makeInputDialog('core/explorerLayout/newFileDialog.html', function(scope) {
							scope.import = function() {
								clDialog.cancel();
								importFile();
							};
						})
						.then(function(name) {
							var newFileDao = clFileSvc.createFile();
							newFileDao.state = 'loaded';
							newFileDao.readContent();
							newFileDao.name = name;
							newFileDao.contentDao.properties = clSettingSvc.values.defaultFileProperties || {};
							newFileDao.writeContent();
							if (folderDao && clFolderSvc.folderMap[folderDao.id]) {
								newFileDao.folderId = folderDao.id;
								newFileDao.userId = folderDao.userId;
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
					clExplorerLayoutSvc.files.cl_each(function(fileDao) {
						fileDao.isSelected = true;
					});
				};

				scope.selectNone = function() {
					clExplorerLayoutSvc.files.cl_each(function(fileDao) {
						fileDao.isSelected = false;
					});
				};

				scope.sortByDate = function(value) {
					clExplorerLayoutSvc.isSortedByDate = value;
					clExplorerLayoutSvc.moreFiles(true);
					clExplorerLayoutSvc.refreshFiles();
					folderElt.scrollTop = 0;
				};

				(function() {
					var filesToRemove, folderToRemove;

					function remove() {
						clFileSvc.setDeletedFiles(filesToRemove);
						if (folderToRemove && clFolderSvc.setDeletedFolder(folderToRemove) >= 0) {
							var newIndex = clExplorerLayoutSvc.folders.indexOf(folderToRemove) - 1;
							var currentFolderDao = clExplorerLayoutSvc.folders[newIndex] || clExplorerLayoutSvc.unclassifiedFolder;
							clExplorerLayoutSvc.setCurrentFolder(currentFolderDao);
						}
					}

					function deleteConfirm() {
						if (!filesToRemove.length) {
							// No confirmation
							return remove();
						}
						var title = folderToRemove ? 'Delete folder' : 'Delete files';
						var confirm = clDialog.confirm()
							.title(title)
							.ariaLabel(title)
							.content('You\'re about to delete ' + filesToRemove.length + ' file(s). Are you sure?')
							.ok('Yes')
							.cancel('No');
						clDialog.show(confirm).then(remove);
					}

					scope.deleteFile = function(fileDao) {
						folderToRemove = null;
						filesToRemove = [fileDao];
						deleteConfirm();
					};

					scope.deleteConfirm = function(deleteFolder) {
						folderToRemove = null;
						if (deleteFolder) {
							folderToRemove = clExplorerLayoutSvc.currentFolderDao;
							!clExplorerLayoutSvc.currentFolderDao.userId && scope.selectAll();
						}
						clExplorerLayoutSvc.updateSelectedFiles(); // updateSelectedFiles is called automatically but later
						filesToRemove = clExplorerLayoutSvc.selectedFiles;

						if (folderToRemove) {
							if (clClasseurSvc.classeurs.cl_some(function(classeurDao) {
									if (classeurDao !== clExplorerLayoutSvc.currentClasseurDao && classeurDao.folders.indexOf(folderToRemove) !== -1) {
										return true;
									}
								})) {
								var title = 'Delete folder';
								var confirm = clDialog.confirm()
									.title(title)
									.ariaLabel(title)
									.content('Do you want to remove the folder from all classeurs?')
									.ok('This only')
									.cancel('All');
								return clDialog.show(confirm).then(function() {
									clExplorerLayoutSvc.currentClasseurDao.folders = clExplorerLayoutSvc.currentClasseurDao.folders.cl_filter(function(folderInClasseur) {
										return folderInClasseur.id !== folderToRemove.id;
									});
									clClasseurSvc.init();
									clExplorerLayoutSvc.refreshFolders();
								}, deleteConfirm);
							}
						}
						deleteConfirm();
					};

				})();

				scope.createClasseur = function() {
					makeInputDialog('core/explorerLayout/newClasseurDialog.html')
						.then(function(name) {
							var classeurDao = clClasseurSvc.createClasseur(name);
							scope.setClasseur(classeurDao);
						});
				};

				scope.deleteClasseur = function(classeurDao) {
					var filesToRemove = [];
					var foldersToRemove = classeurDao.folders.cl_filter(function(folderDao) {
						if (!clClasseurSvc.classeurs.cl_some(function(otherClasseurDao) {
								return otherClasseurDao !== classeurDao && otherClasseurDao.folders.indexOf(folderDao) !== -1;
							})) {
							filesToRemove = filesToRemove.concat(clExplorerLayoutSvc.files.cl_filter(function(fileDao) {
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

					clDialog.show({
						templateUrl: 'core/explorerLayout/deleteClasseurDialog.html',
						onComplete: function(scope) {
							scope.remove = function() {
								clFileSvc.setDeletedFiles(filesToRemove);
								clFolderSvc.setDeletedFolders(foldersToRemove);
								clDialog.hide();
							};
							scope.move = function() {
								clDialog.hide();
							};
							scope.cancel = function() {
								clDialog.cancel();
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
					folderElt.scrollTop = 0;
				}

				scope.$watch('explorerLayoutSvc.isExplorerOpen', animateLayout);
				scope.$watch('fileSvc.files', clExplorerLayoutSvc.refreshFiles);
				scope.$watch('folderSvc.folders', function() {
					clClasseurSvc.init();
					clExplorerLayoutSvc.refreshFolders();
				});
				scope.$watch('classeurSvc.classeurs.length', function() {
					clExplorerLayoutSvc.refreshFolders();
					scope.classeurIndex = clClasseurSvc.classeurs.indexOf(clExplorerLayoutSvc.currentClasseurDao);
				});
				scope.$watch('explorerLayoutSvc.currentFolderDao', function(folderDao) {
					scope.fileFilter = undefined;
					refreshFiles();
					setPlasticClass();
					clPublicSyncSvc.getFolder(folderDao);
				});
				scope.$watch('fileFilter', function(value) {
					clExplorerLayoutSvc.setFileFilter(value);
					refreshFiles();
				});
				scope.$watch('explorerLayoutSvc.files', scope.triggerInfiniteScroll);
				scope.$watch('explorerLayoutSvc.currentClasseurDao', function() {
					scope.classeurIndex = clClasseurSvc.classeurs.indexOf(clExplorerLayoutSvc.currentClasseurDao);
					setPlasticClass();
				});
				scope.$watch('explorerLayoutSvc.currentFolderDao.sharing', clExplorerLayoutSvc.setEffectiveSharing);

				// Refresh selectedFiles on every digest and add 1 cycle when length changes
				scope.$watch('explorerLayoutSvc.updateSelectedFiles().length', function() {});

				scope.$on('$destroy', function() {
					clExplorerLayoutSvc.clean();
				});
			}
		})
	.factory('clExplorerLayoutSvc',
		function($rootScope, clLocalStorage, clFolderSvc, clFileSvc, clClasseurSvc) {
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
				clExplorerLayoutSvc.files = clExplorerLayoutSvc.currentFolderDao ? clFileSvc.files.cl_filter(
					clExplorerLayoutSvc.currentFolderDao === unclassifiedFolder ? function(fileDao) {
						return !fileDao.userId && filterFile(fileDao);
					} : function(fileDao) {
						return fileDao.folderId === clExplorerLayoutSvc.currentFolderDao.id && filterFile(fileDao);
					}).sort(
					clExplorerLayoutSvc.isSortedByDate ? function(fileDao1, fileDao2) {
						return fileDao2.updated - fileDao1.updated;
					} : function(fileDao1, fileDao2) {
						return fileDao1.name.localeCompare(fileDao2.name);
					}
				) : clFileSvc.localFiles.cl_filter(filterFile).sort(function(fileDao1, fileDao2) {
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
				clExplorerLayoutSvc.selectedFiles = clExplorerLayoutSvc.files.cl_filter(function(fileDao) {
					return fileDao.isSelected;
				});
				return clExplorerLayoutSvc.selectedFiles;
			}

			function setEffectiveSharing() {
				if (clExplorerLayoutSvc.currentFolderDao) {
					clExplorerLayoutSvc.currentFolderDao.effectiveSharing = clExplorerLayoutSvc.currentFolderDao.sharing;
				}
				clExplorerLayoutSvc.files.cl_each(function(fileDao) {
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
			}

			function setCurrentFolderInClasseur(folderDao) {
				if (!clClasseurSvc.classeurs.cl_some(function(classeurDao) {
						if (classeurDao.folders.indexOf(folderDao) !== -1) {
							setCurrentClasseur(classeurDao);
							return true;
						}
					})) {
					setCurrentClasseur(clClasseurSvc.defaultClasseur);
				}
				setCurrentFolder(folderDao);
				clExplorerLayoutSvc.refreshFolders();
			}

			var clExplorerLayoutSvc = {
				scrollbarWidth: 0,
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
				setCurrentFolderInClasseur: setCurrentFolderInClasseur,
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
