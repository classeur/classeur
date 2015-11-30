angular.module('classeur.optional.electron', [])
	.directive('clLocalFileAlert',
		function($timeout, clEditorLayoutSvc, clLocalSettingSvc) {
			return {
				restrict: 'E',
				scope: true,
				template: '<cl-local-file-alert-panel ng-if="editorLayoutSvc.currentControl === \'localFileAlert\'"></cl-read-only-alert-panel>',
				link: link
			}

			function link(scope) {
				scope.dismiss = function() {
					clLocalSettingSvc.values.localFileAlertDismissed = true
					clEditorLayoutSvc.currentControl = undefined
				}

				scope.$watch('currentFileDao.state === "loaded"', function(loaded) {
					if (!clLocalSettingSvc.values.localFileAlertDismissed && scope.currentFileDao && scope.currentFileDao.isLocalFile && loaded) {
						$timeout(function() {
							clEditorLayoutSvc.currentControl = 'localFileAlert'
						}, 1000)
					}
				})
			}
		})
	.directive('clLocalFileAlertPanel',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'optional/electron/localFileAlertPanel.html',
			}
		})
	.config(
		function($routeProvider) {
			var clElectron = window.clElectron
			if (!clElectron) {
				return
			}

			$routeProvider
				.when('/localFile', {
					template: '<cl-centered-spinner ng-if="::!fileLoaded"></cl-centered-spinner><cl-editor-layout ng-if="::fileLoaded"></cl-editor-layout>',
					controller: function($scope, $timeout, $location, clFileSvc, clUid, clEditorLayoutSvc, clElectronSvc, clDialog, clEditorSvc) {
						function unimplemented() {
							throw new Error('Unimplemented')
						}
						if (!clElectronSvc.watchedFile) {
							return $location.url('')
						}
						var fileDao = new clFileSvc.FileDao(clUid())
						fileDao.isLocalFile = true
						fileDao.path = clElectronSvc.watchedFile.path
						fileDao.name = clElectronSvc.watchedFile.path.split(/[\\\/]/).slice(-1)[0]
						fileDao.read = unimplemented
						fileDao.write = unimplemented
						fileDao.readContent = unimplemented
						fileDao.freeContent = unimplemented
						fileDao.writeContent = unimplemented
						fileDao.load = function() {
							if (fileDao.state) {
								return
							}
							fileDao.state = 'loading'
							$timeout(function() {
								if (fileDao.state === 'loading') {
									clElectronSvc.loadWatchedFile(fileDao)
									fileDao.contentDao.conflicts = {}
									fileDao.contentDao.state = {}
									fileDao.state = 'loaded'
								}
							})
						}
						fileDao.unload = function() {
							clElectron.stopWatching(this.path)
							this.state = undefined
						}
						$scope.loadFile(fileDao)
						$scope.$watch('currentFileDao.state', function(state) {
							if (!state) {
								clElectronSvc.watchedFile = undefined
								return $location.url('')
							} else if (state === 'loaded') {
								var lastRead = clElectronSvc.watchedFile.lastRead
								$scope.$watch('electronSvc.watchedFile.lastRead', function(value) {
									if (
										lastRead !== value &&
										clElectronSvc.watchedFile &&
										fileDao.path === clElectronSvc.watchedFile.path &&
										clElectronSvc.serializeContent(fileDao.contentDao) !== clElectronSvc.watchedFile.content
									) {
										var reloadDialog = clDialog.confirm()
											.title('Reload from disk')
											.content('The file has been modified externally.')
											.ariaLabel('Reload from disk')
											.ok('Reload')
											.cancel('Discard')
										clDialog.show(reloadDialog).then(function() {
											clElectronSvc.loadWatchedFile(fileDao)
											clEditorSvc.setContent(fileDao.contentDao.text)
										})
									}
								})
								clEditorLayoutSvc.init()
								$scope.fileLoaded = true
							}
						})
					}
				})
		})
	.run(
		function($window, $rootScope, $location, $timeout, clElectronSvc, clToast, clSetInterval, clEditorSvc) {
			var clElectron = $window.clElectron
			if (!clElectron) {
				return
			}

			clElectron.addEventListener('error', function(error) {
				clToast(error)
				$rootScope.$apply()
			})

			$rootScope.electronSvc = clElectronSvc
			$rootScope.$watch('electronSvc.watchedFile.path', function(path) {
				if (path) {
					$rootScope.currentFileDao && $rootScope.currentFileDao.unload()
					$rootScope.currentFileDao = undefined
					$timeout(function() {
						$location.url('/localFile')
					})
				}
			})

			clElectron.addEventListener('file', function(file) {
				clElectronSvc.watchedFile = {
					path: file.path,
					content: file.content,
					lastRead: Date.now()
				}
				$rootScope.$apply()
			})

			clSetInterval(function() {
				if (!clElectronSvc.watchedFile || !$rootScope.currentFileDao) {
					return
				}
				var content = clElectronSvc.serializeContent($rootScope.currentFileDao.contentDao)
				if (clElectronSvc.watchedFile.path === $rootScope.currentFileDao.path &&
					$rootScope.currentFileDao.contentDao.savedContent !== content
				) {
					$rootScope.currentFileDao.contentDao.savedContent = content
					clElectron.saveFile({
						path: clElectronSvc.watchedFile.path,
						content: content
					})
				}
			}, 1000)

			$window.document.body.addEventListener('dragover', function(evt) {
				evt.preventDefault()
			})

			$window.document.body.addEventListener('drop', function(evt) {
				evt.preventDefault()
				var files = evt.dataTransfer.files
				files && files[0] && clElectron.startWatching(files[0].path)
			})

			var contextMenuItems = [{
				label: 'Cut',
				keystroke: 'Ctrl/Cmd+X',
				role: 'cut'
			}, {
				label: 'Copy',
				keystroke: 'Ctrl/Cmd+C',
				role: 'copy'
			}, {
				label: 'Paste',
				keystroke: 'Ctrl/Cmd+V',
				role: 'paste'
			}, {
				type: 'separator'
			}, {
				// 	label: 'Undo',
				// 	keystroke: 'Ctrl/Cmd+Z',
				// 	click: function() {
				// 		clEditorSvc.cledit.undoMgr.undo()
				// 	}
				// }, {
				// 	label: 'Redo',
				// 	keystroke: 'Ctrl/Cmd+Y',
				// 	click: function() {
				// 		clEditorSvc.cledit.undoMgr.redo()
				// 	}
				// }, {
				type: 'separator'
			}, {
				label: 'Bold',
				keystroke: 'Ctrl/Cmd+B',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('bold')
				}
			}, {
				label: 'Italic',
				keystroke: 'Ctrl/Cmd+I',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('italic')
				}
			}, {
				type: 'separator'
			}, {
				label: 'Blockquote',
				keystroke: 'Ctrl/Cmd+Q',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('quote')
				}
			}, {
				label: 'Code',
				keystroke: 'Ctrl/Cmd+K',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('code')
				}
			}, {
				label: 'Link',
				keystroke: 'Ctrl/Cmd+L',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('link')
				}
			}, {
				label: 'Image',
				keystroke: 'Ctrl/Cmd+G',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('image')
				}
			}, {
				type: 'separator'
			}, {
				label: 'Numbered list',
				keystroke: 'Ctrl/Cmd+O',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('olist')
				}
			}, {
				label: 'Bullet list',
				keystroke: 'Ctrl/Cmd+U',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('ulist')
				}
			}, {
				label: 'Heading',
				keystroke: 'Ctrl/Cmd+H',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('heading')
				}
			}, {
				label: 'Horizontal rule',
				keystroke: 'Ctrl/Cmd+R',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('hr')
				}
			}]

			var showContextMenu = $window.cledit.Utils.debounce(function() {
				var selectedText = clEditorSvc.cledit.selectionMgr.getSelectedText()
				clElectron.showContextMenu(contextMenuItems, selectedText, function(correction) {
					if (selectedText === clEditorSvc.cledit.selectionMgr.getSelectedText()) {
						clEditorSvc.cledit.replace(
							clEditorSvc.cledit.selectionMgr.selectionStart,
							clEditorSvc.cledit.selectionMgr.selectionEnd,
							correction
						)
					}
				})
			}, 100)

			$window.addEventListener('contextmenu', function(e) {
				if (clEditorSvc.editorElt && clEditorSvc.editorElt.contains(e.target)) {
					e.preventDefault()
					showContextMenu()
				}
			})

			clElectron.addEventListener('version', function(version) {
				version
				$rootScope.$apply()
			})

			// Tells the app is ready
			clElectron.getVersion()
		})
	.factory('clElectronSvc', function() {
		return {
			loadWatchedFile: function(fileDao) {
				fileDao.contentDao.savedContent = this.watchedFile.content
				var parsedContent = this.watchedFile.content.match(/^([\s\S]*?)(?:<!--cldata:(.*)-->)?\s*$/)
				fileDao.contentDao.text = parsedContent[1]
				try {
					var parsedAttributes = JSON.parse(decodeURI(parsedContent[2]))
					fileDao.contentDao.properties = parsedAttributes.properties || {}
					fileDao.contentDao.discussions = parsedAttributes.discussions || {}
					fileDao.contentDao.comments = parsedAttributes.comments || {}
				} catch (e) {
					fileDao.contentDao.properties = {}
					fileDao.contentDao.discussions = {}
					fileDao.contentDao.comments = {}
				}
			},
			serializeContent: function(contentDao) {
				var content = contentDao.text
				var attributes = {}
				if (Object.keys(contentDao.properties).length) {
					attributes.properties = contentDao.properties
				}
				if (Object.keys(contentDao.discussions).length) {
					attributes.discussions = contentDao.discussions
				}
				if (Object.keys(contentDao.comments).length) {
					attributes.comments = contentDao.comments
				}
				if (Object.keys(attributes).length) {
					content += '<!--cldata:' + encodeURI(JSON.stringify(attributes)) + '-->'
				}
				return content
			}
		}
	})
