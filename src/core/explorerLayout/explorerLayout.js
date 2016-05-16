angular.module('classeur.core.explorerLayout', [])
  .directive('clFolderButton',
    function ($window, $timeout, clExplorerLayoutSvc, clFolderSvc) {
      return {
        restrict: 'A',
        scope: true,
        link: link
      }

      var nextTickAdjustScrollTop
      function link (scope, element, attr) {
        var folderEntryElt = element[0]
        var scrollerElt = folderEntryElt.parentNode
        var scrollerMarginElt = scrollerElt.querySelector('.folder-list__scroller-margin')
        var duration
        if (attr.folder) {
          scope.folder = scope.$eval(attr.folder)
        }
        if (scope.folder && clFolderSvc.activeDaoMap[scope.folder.id]) {
          scope.folder.entryElt = folderEntryElt
        }
        var isHover
        var y = 0

        function adjustScrollTop () {
          var minY = scrollerElt.scrollTop + 30
          var maxY = scrollerElt.scrollTop + scrollerElt.clientHeight - folderEntryElt.offsetHeight - 190
          if (y > maxY) {
            scrollerElt.scrollTop += y - maxY
          }
          if (y < minY) {
            scrollerElt.scrollTop += y - minY
          }
          clExplorerLayoutSvc.toggleCurrentFolderEntry()
        }

        function animate () {
          var isSelected = clExplorerLayoutSvc.currentFolder === scope.folder
          folderEntryElt.classList.toggle('folder-entry--selected', isSelected)
          folderEntryElt.classList.toggle('md-whiteframe-4dp', isSelected)
          folderEntryElt.classList.toggle('md-whiteframe-1dp', !isSelected)
          var z = isSelected ? 10000 : (scope.$index !== undefined ? scope.explorerLayoutSvc.folders.length - scope.$index : 9997)
          folderEntryElt.clanim
            .zIndex(z)
            .start()
            .offsetWidth // Force z-offset to refresh before the animation
          folderEntryElt.clanim
            .duration(duration)
            .translateX(isSelected ? 0 : isHover ? -1 : -5)
            .translateY(y)
            .easing('materialOut')
            .start(true, nextTickAdjustScrollTop && isSelected
              ? adjustScrollTop
              : clExplorerLayoutSvc.toggleCurrentFolderEntry)
          duration = 400
          if (nextTickAdjustScrollTop && isSelected) {
            adjustScrollTop()
            nextTickAdjustScrollTop = false
          } else {
            clExplorerLayoutSvc.toggleCurrentFolderEntry()
          }
        }
        var debounceAnimate = $window.cledit.Utils.debounce(animate, 100)

        folderEntryElt.addEventListener('mouseenter', function () {
          isHover = true
          debounceAnimate()
        })
        folderEntryElt.addEventListener('mouseleave', function () {
          isHover = false
          debounceAnimate()
        })

        scope.$watch('explorerLayoutSvc.currentFolder === folder', function () {
          nextTickAdjustScrollTop = true
          duration
            ? animate() // toggleCurrentFolderEntry can't wait for debounce
            : debounceAnimate()
        })

        scope.$watch(function () {
          y = 0
          if (!clExplorerLayoutSvc.folders.cl_some(
              function (folder, i) {
                if (folder === scope.folder) {
                  if (i === clExplorerLayoutSvc.folders.length - 1) {
                    scrollerMarginElt.style.top = y + folder.entryElt.offsetHeight + 'px'
                  }
                  return true
                }
                if (folder.entryElt) {
                  y += folder.entryElt.offsetHeight
                }
              })
          ) {
            y = 0
          }
          return y
        }, debounceAnimate)

        scope.$on('$destroy', function () {
          if (scope.folder) {
            scope.folder.entryElt = undefined
          }
        })
      }
    })
  .directive('clFileDropInput',
    function ($window, clToast, clDialog) {
      var maxSize = 200000
      return {
        restrict: 'A',
        link: function (scope, element) {
          function uploadFile (file) {
            var reader = new $window.FileReader()
            reader.onload = function (e) {
              var content = e.target.result
              if (content.match(/\uFFFD/)) {
                return clToast('File is not readable.')
              }
              clDialog.hide({
                name: file.name.slice(0, 128),
                content: content
              })
            }
            var blob = file.slice(0, maxSize)
            reader.readAsText(blob)
          }
          var elt = element[0]
          elt.addEventListener('change', function (evt) {
            var files = evt.target.files
            files[0] && uploadFile(files[0])
          })
          elt.addEventListener('dragover', function (evt) {
            evt.stopPropagation()
            evt.preventDefault()
            evt.dataTransfer.dropEffect = 'copy'
          })
          elt.addEventListener('dragover', function (evt) {
            evt.stopPropagation()
            evt.preventDefault()
            evt.dataTransfer.dropEffect = 'copy'
          })
          elt.addEventListener('drop', function (evt) {
            var files = (evt.dataTransfer || evt.target).files
            if (files[0]) {
              evt.stopPropagation()
              evt.preventDefault()
              uploadFile(files[0])
            }
          })
        }
      }
    })
  .directive('clExplorerLayout',
    function ($window, $timeout, $location, clUrl, clDialog, clUserSvc, clExplorerLayoutSvc, clFileSvc, clFolderSvc, clClasseurSvc, clToast, clConfig, clSyncSvc, clSettingSvc) {
      var explorerMaxWidth = 760
      var noPaddingWidth = 580
      var hideOffsetY = 2000
      return {
        restrict: 'E',
        templateUrl: 'core/explorerLayout/explorerLayout.html',
        link: link
      }

      function link (scope, element) {
        var explorerInnerElt = element[0].querySelector('.explorer__inner-2')
        var binderElt = element[0].querySelector('.explorer-binder')
        var navbarInnerElt = element[0].querySelector('.navbar__inner')
        var binderScrollerElt = element[0].querySelector('.explorer-binder__scroller')
        var folderElt = element[0].querySelector('.folder-view--main')
        var folderCloneElt = element[0].querySelector('.folder-view--clone')
        var fileActionsElt = folderElt.querySelector('.file-actions')
        var folderListElt = element[0].querySelector('.folder-list')
        var folderListScrollerElt = folderListElt.querySelector('.folder-list__scroller')
        var createFolderButtonElt = folderListElt.querySelector('.folder-entry--create')

        clExplorerLayoutSvc.toggleCurrentFolderEntry = function () {
          folderListElt.classList.toggle('folder-list__show-current',
            !!clExplorerLayoutSvc.currentFolder &&
            !!clExplorerLayoutSvc.currentFolder.entryElt &&
            clExplorerLayoutSvc.currentFolder.entryElt.getBoundingClientRect().top < createFolderButtonElt.getBoundingClientRect().bottom
          )
        }

        function toggleFolderCloneElt () {
          folderCloneElt.classList.toggle('folder-view--hidden', folderElt.scrollTop < fileActionsElt.offsetTop)
        }

        folderElt.addEventListener('scroll', toggleFolderCloneElt)
        setTimeout(toggleFolderCloneElt, 1)

        folderListScrollerElt.addEventListener('scroll', clExplorerLayoutSvc.toggleCurrentFolderEntry)

        function updateLayout () {
          var explorerWidth = document.body.clientWidth
          if (explorerWidth > explorerMaxWidth) {
            explorerWidth = explorerMaxWidth
          }
          clExplorerLayoutSvc.explorerWidth = explorerWidth
          clExplorerLayoutSvc.noPadding = explorerWidth < noPaddingWidth
          clExplorerLayoutSvc.binderY = clExplorerLayoutSvc.isExplorerOpen ? 0 : hideOffsetY
        }

        function animateLayout () {
          clExplorerLayoutSvc.scrollbarWidth = folderElt.offsetWidth - folderElt.clientWidth
          updateLayout()
          explorerInnerElt.clanim
            .width(clExplorerLayoutSvc.explorerWidth - 50)
            .translateX(-clExplorerLayoutSvc.explorerWidth / 2 + 5)
            .start()
            .classList.toggle('explorer__inner-2--no-padding', clExplorerLayoutSvc.noPadding)
          navbarInnerElt.clanim
            .width(clExplorerLayoutSvc.explorerWidth)
            .start()
            .classList.toggle('navbar__inner--no-padding', clExplorerLayoutSvc.noPadding)
          binderElt.clanim
            .translateY(clExplorerLayoutSvc.binderY)
            .duration(300)
            .easing(clExplorerLayoutSvc.isExplorerOpen ? 'materialOut' : 'materialIn')
            .start(true)
          var folderContainerWidth = clExplorerLayoutSvc.explorerWidth + clExplorerLayoutSvc.scrollbarWidth
          binderScrollerElt.clanim
            .width(folderContainerWidth)
            .start()
          folderCloneElt.clanim
            .width(folderContainerWidth)
            .start()
        }

        window.addEventListener('resize', animateLayout)
        scope.$on('$destroy', function () {
          window.removeEventListener('resize', animateLayout)
        })

        function setPlasticClass () {
          if (clExplorerLayoutSvc.currentFolder) {
            if (clExplorerLayoutSvc.currentFolder === clExplorerLayoutSvc.unclassifiedFolder) {
              scope.plasticClass = clExplorerLayoutSvc.currentClasseur.colorClass1
            } else {
              scope.plasticClass = clExplorerLayoutSvc.currentFolder.colorClass
            }
          } else {
            scope.plasticClass = clExplorerLayoutSvc.currentClasseur.colorClass0
          }
        }

        scope.folderNameModified = function () {
          clExplorerLayoutSvc.refreshFolders()
          setPlasticClass()
        }

        function makeInputDialog (templateUrl, controller) {
          return clDialog.show({
            templateUrl: templateUrl,
            focusOnOpen: false,
            controller: ['$scope', function (scope) {
              scope.ok = function () {
                if (!scope.value) {
                  return scope.focus()
                }
                clDialog.hide(scope.value)
              }
              scope.cancel = function () {
                clDialog.cancel()
              }
              controller && controller(scope)
            }]
          })
        }

        function importExistingFolder (folder, move) {
          if (move) {
            // Remove folder from any other classeur
            clClasseurSvc.activeDaos.cl_each(function (classeur) {
              if (clExplorerLayoutSvc.currentClasseur !== classeur) {
                var index = classeur.folders.indexOf(folder)
                if (~index) {
                  clClasseurSvc.removeFolderFromClasseur(classeur, folder)
                }
              }
            })
          } else {
            // If folder was in default classeur, make sure it's attached properly otherwise it won't appear anymore
            if (~clClasseurSvc.defaultClasseur.folders.indexOf(folder)) {
              clClasseurSvc.addFolderToClasseur(clClasseurSvc.defaultClasseur, folder)
            }
          }
          clClasseurSvc.addFolderToClasseur(clExplorerLayoutSvc.currentClasseur, folder)
          clClasseurSvc.init()
          clExplorerLayoutSvc.refreshFolders()
          clExplorerLayoutSvc.setCurrentFolder(folder)
          clDialog.cancel()
        }

        function importPublicFolder (folderId) {
          // Classeurs are updated when evaluating folderSvc.activeDaos
          var folder = clFolderSvc.createPublicFolder(folderId)
          clClasseurSvc.addFolderToClasseur(clExplorerLayoutSvc.currentClasseur, folder)
          $timeout(function () {
            clExplorerLayoutSvc.setCurrentFolder(folder)
          })
          clDialog.cancel()
        }

        function importFolder () {
          makeInputDialog('core/explorerLayout/importFolderDialog.html', function (scope) {
            scope.importType = 'otherUser'
            var classeurFolders = clExplorerLayoutSvc.currentClasseur.folders.cl_reduce(function (classeurFolders, folder) {
              classeurFolders[folder.id] = folder
              return classeurFolders
            }, {})
            scope.folders = clFolderSvc.activeDaos.cl_filter(function (folder) {
              return !classeurFolders[folder.id]
            })
            scope.move = true
            var ok = scope.ok
            scope.ok = function () {
              if (scope.importType === 'otherClasseur') {
                if (!scope.folderId) {
                  return clToast('Please select a folder.')
                }
                var folder = clFolderSvc.activeDaoMap[scope.folderId]
                folder && importExistingFolder(folder, scope.move)
                return clDialog.cancel()
              }
              ok()
            }
          })
            .then(function (link) {
              var components = link.split('/')
              var folderId = components[components.length - 1]
              if (!folderId || link.indexOf(clConfig.appUri) !== 0) {
                clToast('Invalid folder link.')
              }
              if (clExplorerLayoutSvc.currentClasseur.folders
                  .cl_some(function (folder) {
                    return folder.id === folderId
                  })) {
                clToast('Folder is already in the classeur.')
              }
              var folder = clFolderSvc.activeDaoMap[folderId]
              folder ? importExistingFolder(folder) : importPublicFolder(folderId)
            })
        }

        function createFolder () {
          makeInputDialog('core/explorerLayout/newFolderDialog.html', function (scope) {
            scope.import = function () {
              clDialog.cancel()
              importFolder()
            }
          })
            .then(function (name) {
              // Classeurs are automatically updated when evaluating folderSvc.activeDaos
              var folder = clFolderSvc.createFolder()
              folder.name = name
              // It's not necessary to attach folder to the defaultClasseur as it's done by default
              if (clExplorerLayoutSvc.currentClasseur !== clClasseurSvc.defaultClasseur) {
                clClasseurSvc.addFolderToClasseur(clExplorerLayoutSvc.currentClasseur, folder)
              }
              $timeout(function () {
                clExplorerLayoutSvc.setCurrentFolder(folder)
              })
            })
        }

        function importFile () {
          var folder = clExplorerLayoutSvc.currentFolder
          makeInputDialog('core/explorerLayout/importFileDialog.html', function (scope) {
            scope.importType = 'otherUser'
            if (!folder && clExplorerLayoutSvc.currentClasseur !== clClasseurSvc.defaultClasseur) {
              scope.orphanWarning = true
            }
            scope.cancel = function () {
              clDialog.cancel()
            }
            scope.ok = function () {
              if (!scope.value) {
                return scope.focus()
              }
              var link = scope.value
              var components = link.split('/')
              var fileId = components[components.length - 1]
              if (!fileId || link.indexOf(clConfig.appUri) !== 0) {
                clToast('Invalid file link.')
              }
              $location.url(clUrl.file(fileId))
              clDialog.cancel()
            }
          })
            .then(function (file) {
              var newFileDao = clFileSvc.createFile()
              newFileDao.state = 'loaded'
              newFileDao.readContent()
              newFileDao.name = file.name
              newFileDao.content.text = file.content
              newFileDao.content.properties = clSettingSvc.values.defaultFileProperties || {}
              newFileDao.writeContent()
              if (folder && clFolderSvc.activeDaoMap[folder.id]) {
                newFileDao.folderId = folder.id
                newFileDao.userId = folder.userId
                if (folder.userId) {
                  newFileDao.sharing = folder.sharing
                }
              }
              scope.setCurrentFile(newFileDao)
            })
        }

        scope.createFile = function () {
          var folder = clExplorerLayoutSvc.currentFolder
          makeInputDialog('core/explorerLayout/newFileDialog.html', function (scope) {
            if (!folder && clExplorerLayoutSvc.currentClasseur !== clClasseurSvc.defaultClasseur) {
              scope.orphanWarning = true
            }
            scope.import = function () {
              clDialog.cancel()
              importFile()
            }
          })
            .then(function (name) {
              var newFileDao = clFileSvc.createFile()
              newFileDao.state = 'loaded'
              newFileDao.readContent()
              newFileDao.name = name
              newFileDao.content.properties = clSettingSvc.values.defaultFileProperties || {}
              newFileDao.writeContent()
              if (folder && clFolderSvc.activeDaoMap[folder.id]) {
                newFileDao.folderId = folder.id
                newFileDao.userId = folder.userId
                if (folder.userId) {
                  newFileDao.sharing = folder.sharing
                }
              }
              scope.setCurrentFile(newFileDao)
            })
        }

        // setInterval(function() {
        // 	var file = clFileSvc.createFile()
        // 	file.name = 'File ' + file.id
        // 	file.folderId = clFolderSvc.activeDaos[Math.random() * clFolderSvc.activeDaos.length | 0].id
        // 	scope.$apply()
        // }, 1000)

        // setInterval(function() {
        // 	var folder = clFolderSvc.createFolder()
        // 	folder.name = 'Folder ' + folder.id
        //  clClasseurSvc.addFolderToClasseur(clExplorerLayoutSvc.currentClasseur, folder)
        // 	scope.$apply()
        // }, 15000)

        scope.setFolder = function (folder) {
          if (folder === clExplorerLayoutSvc.createFolder) {
            return createFolder()
          }
          clExplorerLayoutSvc.setCurrentFolder(folder)
        }

        scope.selectAll = function () {
          var doAll = true
          clExplorerLayoutSvc.files.cl_each(function (file) {
            if (!file.isSelected) {
              doAll = false
              file.isSelected = true
            }
          })
          doAll && clExplorerLayoutSvc.extraFiles.cl_each(function (file) {
            file.isSelected = true
          })
        }

        scope.selectNone = function () {
          clExplorerLayoutSvc.selectedFiles.cl_each(function (file) {
            file.isSelected = false
          })
        }

        scope.sortByDate = function (value) {
          clExplorerLayoutSvc.isSortedByDate = value
          clExplorerLayoutSvc.moreFiles(true)
          clExplorerLayoutSvc.refreshFiles()
          folderElt.scrollTop = 0
        }

        ;(function () {
          var filesToRemove, folderToRemove

          function remove () {
            clFileSvc.setDeletedFiles(filesToRemove)
            if (folderToRemove && clFolderSvc.setDeletedFolder(folderToRemove) >= 0) {
              var newIndex = clExplorerLayoutSvc.folders.indexOf(folderToRemove) - 1
              var currentFolder = clExplorerLayoutSvc.folders[newIndex] || clExplorerLayoutSvc.unclassifiedFolder
              clExplorerLayoutSvc.setCurrentFolder(currentFolder)
            }
          }

          function deleteConfirm () {
            if (!filesToRemove.length) {
              // No confirmation
              return remove()
            }
            var title = folderToRemove ? 'Delete folder' : 'Delete files'
            var confirm = clDialog.confirm()
              .title(title)
              .ariaLabel(title)
              .content("You're about to delete " + filesToRemove.length + ' file(s). Are you sure?')
              .ok('Yes')
              .cancel('No')
            clDialog.show(confirm).then(remove)
          }

          scope.deleteFile = function (file) {
            folderToRemove = null
            filesToRemove = [file]
            deleteConfirm()
          }

          scope.deleteConfirm = function (deleteFolder) {
            folderToRemove = null
            if (deleteFolder) {
              folderToRemove = clExplorerLayoutSvc.currentFolder
              !clExplorerLayoutSvc.currentFolder.userId && scope.selectAll()
            }
            clExplorerLayoutSvc.updateSelectedFiles() // updateSelectedFiles is called automatically but later
            filesToRemove = clExplorerLayoutSvc.selectedFiles
            deleteConfirm()
          }
        })()

        scope.isFolderInOtherClasseur = function () {
          return clClasseurSvc.activeDaos.cl_some(function (classeur) {
            return classeur !== clExplorerLayoutSvc.currentClasseur && ~classeur.folders.indexOf(clExplorerLayoutSvc.currentFolder)
          })
        }

        scope.removeFolderFromClasseur = function () {
          clClasseurSvc.removeFolderFromClasseur(clExplorerLayoutSvc.currentClasseur, clExplorerLayoutSvc.currentFolder)
          clClasseurSvc.init()
          clExplorerLayoutSvc.refreshFolders()
        }

        function importClasseur () {
          makeInputDialog('core/explorerLayout/importClasseurDialog.html')
            .then(function (link) {
              var components = link.split('/')
              var classeurId = components[components.length - 1]
              if (!classeurId || link.indexOf(clConfig.appUri) !== 0) {
                clToast('Invalid classeur link.')
              }
              $location.url(clUrl.classeur(classeurId))
            })
        }

        scope.createClasseur = function () {
          makeInputDialog('core/explorerLayout/newClasseurDialog.html', function (scope) {
            scope.ok = function () {
              if (!scope.value) {
                return scope.focus()
              }
              var classeur = clClasseurSvc.createClasseur()
              classeur.name = scope.value
              classeur.userId = scope.isPublic ? 'null' : ''
              clDialog.hide(classeur)
            }
            scope.import = function () {
              clDialog.cancel()
              importClasseur()
            }
          })
            .then(function (classeur) {
              scope.setClasseur(classeur)
            })
        }

        scope.deleteClasseur = function (classeur) {
          var filesToRemove = []
          var foldersToRemove = classeur.folders.cl_filter(function (folder) {
            if (!clClasseurSvc.activeDaos
                .cl_some(function (otherClasseurDao) {
                  return otherClasseurDao !== classeur && ~otherClasseurDao.folders.indexOf(folder)
                })) {
              filesToRemove = filesToRemove.concat(clExplorerLayoutSvc.files.cl_filter(function (file) {
                return file.folderId === folder.id
              }))
              return true
            }
          })

          function remove () {
            if (classeur.userId === 'null') {
              classeur.folders.cl_each(function (folder) {
                if (!folder.userId) {
                  // Prevent private folders from remaining in the public classeur, in case user re-import it later
                  clClasseurSvc.removeFolderFromClasseur(classeur, folder)
                }
              })
            }
            clClasseurSvc.setDeletedClasseurs([classeur])
          }

          if (!foldersToRemove.length) {
            return remove()
          }

          clDialog.show({
            templateUrl: 'core/explorerLayout/deleteClasseurDialog.html',
            onComplete: function (scope) {
              scope.remove = function () {
                clFileSvc.setDeletedFiles(filesToRemove)
                clFolderSvc.setDeletedFolders(foldersToRemove)
                clDialog.hide()
              }
              scope.move = function () {
                clDialog.hide()
              }
              scope.cancel = function () {
                clDialog.cancel()
              }
            }
          }).then(remove)
        }

        scope.setClasseur = function (classeur) {
          folderListScrollerElt.scrollTop = 0
          clExplorerLayoutSvc.setCurrentClasseur(classeur)
          clExplorerLayoutSvc.setCurrentFolder(classeur.lastFolder)
          clExplorerLayoutSvc.refreshFolders()
          clExplorerLayoutSvc.toggleExplorer(true)
        }

        scope.signout = function () {
          clUserSvc.signout()
          clExplorerLayoutSvc.toggleExplorer(true)
        }

        function refreshFiles () {
          folderElt.scrollTop = 0
          clExplorerLayoutSvc.refreshFiles()
          scope.selectNone()
        }

        scope.$watch('explorerLayoutSvc.isExplorerOpen', animateLayout)
        scope.$watch('fileSvc.activeDaos', clExplorerLayoutSvc.refreshFiles)
        scope.$watch('folderSvc.activeDaos', function () {
          clClasseurSvc.init()
          clExplorerLayoutSvc.refreshFolders()
        })
        scope.$watchGroup(['classeurSvc.activeDaos', 'classeurSvc.activeDaos.length'], function () {
          clExplorerLayoutSvc.refreshFolders()
          setPlasticClass()
        })
        scope.$watchGroup(['explorerLayoutSvc.currentClasseur', 'explorerLayoutSvc.currentFolder'], function () {
          scope.userInputFilter = undefined
          refreshFiles()
          setPlasticClass()
          clSyncSvc.getClasseur(clExplorerLayoutSvc.currentClasseur)
          clSyncSvc.getFolder(clExplorerLayoutSvc.currentFolder)
        })
        scope.$watch('userInputFilter', function (value) {
          clExplorerLayoutSvc.setUserInputFilter(value)
          refreshFiles()
        })
        scope.$watch('explorerLayoutSvc.files', function () {
          clExplorerLayoutSvc.moreFiles(true)
          scope.doInfiniteScroll() // In case page size is smaller than scroller size
        })
        scope.$watch('explorerLayoutSvc.currentFolder.sharing', clExplorerLayoutSvc.setEffectiveSharing)

        // Refresh selectedFiles on every digest and add 1 cycle when length changes
        scope.$watch('explorerLayoutSvc.updateSelectedFiles().length', function () {})

        scope.$on('$destroy', function () {
          clExplorerLayoutSvc.clean()
        })

        clExplorerLayoutSvc.init()
      }
    })
  .factory('clExplorerLayoutSvc',
    function ($rootScope, clLocalStorage, clFolderSvc, clFileSvc, clClasseurSvc) {
      var pageSize = 20
      var lastClasseurKey = 'lastClasseurId'
      var lastFolderKey = 'lastFolderId'
      var unclassifiedFolder = {
        id: 'unclassified',
        name: 'All files'
      }
      var createFolder = {
        id: 'create',
        name: 'Create folder'
      }

      var clExplorerLayoutSvc = {
        isSortedByDate: true,
        scrollbarWidth: 0,
        folders: [],
        files: [],
        extraFiles: [],
        selectedFiles: [],
        unclassifiedFolder: unclassifiedFolder,
        createFolder: createFolder,
        refreshFolders: refreshFolders,
        refreshFiles: refreshFiles,
        moreFiles: moreFiles,
        setUserInputFilter: setUserInputFilter,
        updateSelectedFiles: updateSelectedFiles,
        setEffectiveSharing: setEffectiveSharing,
        setCurrentClasseur: setCurrentClasseur,
        setCurrentFolder: setCurrentFolder,
        setCurrentFolderInClasseur: setCurrentFolderInClasseur,
        init: init,
        reset: function () {
          this.isExplorerOpen = true
        },
        clean: function () {
          clExplorerLayoutSvc.sharingDialogFileDao = undefined
        },
        toggleExplorer: function (isOpen) {
          this.isExplorerOpen = isOpen === undefined ? !this.isExplorerOpen : isOpen
        }
      }

      var isInitialized

      function init () {
        if (!isInitialized) {
          setCurrentClasseur(clClasseurSvc.activeDaoMap[clLocalStorage[lastClasseurKey]])
          setCurrentFolder(clFolderSvc.activeDaoMap[clLocalStorage[lastFolderKey]])
          moreFiles(true)
          isInitialized = true
        }
      }

      var endFileIndex, userInputFilter

      function moreFiles (reset) {
        if (reset) {
          endFileIndex = 0
        }
        if (endFileIndex < clExplorerLayoutSvc.files.length + clExplorerLayoutSvc.extraFiles.length) {
          endFileIndex += pageSize
          clExplorerLayoutSvc.pagedFiles = clExplorerLayoutSvc.files.slice(0, endFileIndex)
          clExplorerLayoutSvc.pagedExtraFiles = clExplorerLayoutSvc.extraFiles.slice(0, endFileIndex - clExplorerLayoutSvc.pagedFiles.length)
          return true
        }
      }

      function inputFilter (file) {
        return !userInputFilter || ~file.name.toLowerCase().indexOf(userInputFilter)
      }

      function currentFolderFilter (file) {
        return file.folderId === clExplorerLayoutSvc.currentFolder.id
      }

      function refreshFiles () {
        var filters = []
        var files = clFileSvc.activeDaos
        var extraFiles = []

        function currentClasseurFilter (file) {
          var result = clExplorerLayoutSvc.currentClasseur.isDefault
          if (clFolderSvc.activeDaoMap[file.folderId]) {
            result = clExplorerLayoutSvc.currentClasseur.folders.cl_some(function (folder) {
              return folder.id === file.folderId
            })
          }
          !result && extraFiles.push(file)
          return result
        }

        if (clExplorerLayoutSvc.currentFolder === unclassifiedFolder) {
          filters.push(inputFilter)
          filters.push(currentClasseurFilter)
        } else if (clExplorerLayoutSvc.currentFolder) {
          filters.push(currentFolderFilter)
          filters.push(inputFilter)
        } else {
          files = clFileSvc.localFiles
          filters.push(inputFilter)
          filters.push(currentClasseurFilter)
        }
        filters.cl_each(function (filter) {
          files = files.cl_filter(filter)
        })

        var sort
        if (!clExplorerLayoutSvc.currentFolder) {
          // Sort by local content change (recent files)
          sort = function (file1, file2) {
            return file2.content.lastChange - file1.content.lastChange
          }
        } else if (clExplorerLayoutSvc.isSortedByDate) {
          // Sort by server change
          sort = function (file1, file2) {
            return file2.updated - file1.updated
          }
        } else {
          // Sort by name
          sort = function (file1, file2) {
            return file1.name.localeCompare(file2.name)
          }
        }
        clExplorerLayoutSvc.files = files.sort(sort)
        clExplorerLayoutSvc.extraFiles = extraFiles.sort(sort)
        clExplorerLayoutSvc.pagedFiles = clExplorerLayoutSvc.files.slice(0, endFileIndex)
        clExplorerLayoutSvc.pagedExtraFiles = clExplorerLayoutSvc.extraFiles.slice(0, endFileIndex - clExplorerLayoutSvc.pagedFiles.length)
        setEffectiveSharing()
      }

      function setUserInputFilter (value) {
        if (userInputFilter !== value) {
          userInputFilter = value && value.toLowerCase()
          refreshFiles()
        }
      }

      function updateSelectedFiles () {
        clExplorerLayoutSvc.selectedFiles = clExplorerLayoutSvc.files.cl_filter(function (file) {
          return file.isSelected
        }).concat(clExplorerLayoutSvc.extraFiles.cl_filter(function (file) {
          return file.isSelected
        }))
        return clExplorerLayoutSvc.selectedFiles
      }

      function setEffectiveSharing () {
        if (clExplorerLayoutSvc.currentFolder) {
          clExplorerLayoutSvc.currentFolder.effectiveSharing = clExplorerLayoutSvc.currentFolder.sharing
        }
        clExplorerLayoutSvc.files.concat(clExplorerLayoutSvc.extraFiles).cl_each(function (file) {
          file.effectiveSharing = file.sharing
          var folder = clFolderSvc.activeDaoMap[file.folderId]
          if (folder && folder.sharing > file.sharing) {
            file.effectiveSharing = folder.sharing
          }
        })
      }

      function refreshFolders () {
        setCurrentClasseur(clExplorerLayoutSvc.currentClasseur)
        setCurrentFolder(clExplorerLayoutSvc.currentFolder)
        clExplorerLayoutSvc.folders = clExplorerLayoutSvc.currentClasseur.folders.slice().sort(function (folder1, folder2) {
          return folder1.name.localeCompare(folder2.name)
        })
      }

      function setCurrentClasseur (classeur) {
        classeur = (classeur && clClasseurSvc.activeDaoMap[classeur.id]) || clClasseurSvc.defaultClasseur
        clExplorerLayoutSvc.currentClasseur = classeur
        clLocalStorage.setItem(lastClasseurKey, classeur.id)
      }

      function setCurrentFolder (folder) {
        folder = folder === unclassifiedFolder ? folder : (folder && clFolderSvc.activeDaoMap[folder.id])
        if (folder && folder !== unclassifiedFolder && !~clExplorerLayoutSvc.currentClasseur.folders.indexOf(folder)) {
          folder = undefined
        }
        clExplorerLayoutSvc.currentFolder = folder
        clExplorerLayoutSvc.currentClasseur.lastFolder = folder
        folder && folder.id ? clLocalStorage.setItem(lastFolderKey, folder.id) : clLocalStorage.removeItem(lastFolderKey)
      }

      function setCurrentFolderInClasseur (folder) {
        if (!clClasseurSvc.activeDaos
            .cl_some(function (classeur) {
              if (~classeur.folders.indexOf(folder)) {
                setCurrentClasseur(classeur)
                return true
              }
            })) {
          setCurrentClasseur(clClasseurSvc.defaultClasseur)
        }
        setCurrentFolder(folder)
        clExplorerLayoutSvc.refreshFolders()
      }

      return clExplorerLayoutSvc
    })
