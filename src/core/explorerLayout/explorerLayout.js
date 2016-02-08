angular.module('classeur.core.explorerLayout', [])
  .directive('clFolderButton',
    function ($window, clExplorerLayoutSvc) {
      return {
        restrict: 'A',
        scope: true,
        link: link
      }

      function link (scope, element, attr) {
        var folderEntryElt = element[0]
        var parentElt = folderEntryElt.parentNode
        var duration
        if (attr.folder) {
          scope.folderDao = scope.$eval(attr.folder)
        }
        var isHover

        function animate (adjustScrollTop) {
          var isSelected = clExplorerLayoutSvc.currentFolderDao === scope.folderDao
          folderEntryElt.classList.toggle('folder-entry--selected', isSelected)
          var y = scope.$index !== undefined ? 129 + scope.$index * 109 : 0
          var z = isSelected ? 10000 : (scope.$index !== undefined ? scope.explorerLayoutSvc.folders.length - scope.$index : 9997)
          folderEntryElt.clanim
            .zIndex(z)
            .start()
            .offsetWidth // Force z-offset to refresh before the animation
          folderEntryElt.clanim
            .duration(duration)
            .translateX(isSelected ? 0 : isHover ? -2 : -5)
            .translateY(y)
            .easing('materialOut')
            .start(true)
          duration = 400
          if (adjustScrollTop && isSelected) {
            // Adjust scrolling position
            var minY = parentElt.scrollTop + 160
            var maxY = parentElt.scrollTop + parentElt.clientHeight - 180
            if (y > maxY) {
              parentElt.scrollTop += y - maxY
            }
            if (y < minY) {
              parentElt.scrollTop += y - minY
            }
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

        scope.$watch('$index', animate)
        scope.$watch('explorerLayoutSvc.currentFolderDao === folderDao', function (isSelected) {
          if (isSelected) {
            clExplorerLayoutSvc.currentFolderEntryElt = scope.$index !== undefined && folderEntryElt
            clExplorerLayoutSvc.toggleCurrentFolderEntry()
          }
          animate(true)
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
    function ($window, $timeout, clDialog, clUserSvc, clExplorerLayoutSvc, clFileSvc, clFolderSvc, clClasseurSvc, clToast, clConfig, clPublicSyncSvc, clSettingSvc) {
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
        var binderElt = element[0].querySelector('.binder').clanim.translateY(20).start()
        var navbarInnerElt = element[0].querySelector('.navbar__inner')
        var binderScrollerElt = element[0].querySelector('.binder__scroller')
        var folderElt = element[0].querySelector('.folder-view--main')
        var folderCloneElt = element[0].querySelector('.folder-view--clone')
        var fileActionsElt = folderElt.querySelector('.file-actions')
        var folderListElt = element[0].querySelector('.folder-list')
        var folderListScrollerElt = folderListElt.querySelector('.folder-list__scroller')
        var createFolderButtonElt = folderListElt.querySelector('.folder-entry--create .folder-entry__inner-1')

        clExplorerLayoutSvc.toggleCurrentFolderEntry = function () {
          folderListElt.classList.toggle('folder-list__show-current', !!clExplorerLayoutSvc.currentFolderEntryElt &&
            clExplorerLayoutSvc.currentFolderEntryElt.getBoundingClientRect().top < createFolderButtonElt.getBoundingClientRect().bottom - 1)
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

        scope.classeurIndex = 0

        function setPlasticClass () {
          var index = scope.classeurIndex
          if (clExplorerLayoutSvc.currentFolderDao) {
            if (clExplorerLayoutSvc.currentFolderDao === clExplorerLayoutSvc.unclassifiedFolder) {
              index++
            } else {
              index += clExplorerLayoutSvc.folders.indexOf(clExplorerLayoutSvc.currentFolderDao) + 3
            }
          }
          scope.plasticClass = 'plastic-' + (index % 6)
        }

        scope.folderNameModified = function () {
          clExplorerLayoutSvc.currentFolderDao.name = clExplorerLayoutSvc.currentFolderDao.name || 'Untitled'
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

        function importExistingFolder (folderDao, move) {
          move && clClasseurSvc.classeurs.cl_each(function (classeurDao) {
            var index = classeurDao.folders.indexOf(folderDao)
            index !== -1 && classeurDao.folders.splice(index, 1)
          })
          clExplorerLayoutSvc.currentClasseurDao.folders.push(folderDao)
          clClasseurSvc.init()
          clExplorerLayoutSvc.refreshFolders()
          clExplorerLayoutSvc.setCurrentFolder(folderDao)
          clDialog.cancel()
        }

        function importPublicFolder (folderId) {
          var folderDao = clFolderSvc.createPublicFolder(folderId)
          // Classeurs are updated when evaluating folderSvc.folders
          clExplorerLayoutSvc.currentClasseurDao.folders.push(folderDao)
          $timeout(function () {
            clExplorerLayoutSvc.setCurrentFolder(folderDao)
          })
          clDialog.cancel()
        }

        function importFolder () {
          makeInputDialog('core/explorerLayout/importFolderDialog.html', function (scope) {
            scope.importType = 'otherUser'
            var classeurFolders = clExplorerLayoutSvc.currentClasseurDao.folders.cl_reduce(function (classeurFolders, folderDao) {
              return (classeurFolders[folderDao.id] = folderDao, classeurFolders)
            }, {})
            scope.folders = clFolderSvc.folders.cl_filter(function (filterDao) {
              return !filterDao.userId && !classeurFolders.hasOwnProperty(filterDao.id)
            })
            scope.move = true
            var ok = scope.ok
            scope.ok = function () {
              if (scope.importType === 'otherClasseur') {
                if (!scope.folderId) {
                  return clToast('Please select a folder.')
                }
                var folderDao = clFolderSvc.folderMap[scope.folderId]
                folderDao && importExistingFolder(folderDao, scope.move)
                return clDialog.cancel()
              }
              ok()
            }
          }).then(function (link) {
            var components = link.split('/')
            var folderId = components[components.length - 1]
            if (!folderId || link.indexOf(clConfig.appUri) !== 0) {
              clToast('Invalid folder link.')
            }
            if (clExplorerLayoutSvc.currentClasseurDao.folders
                .cl_some(function (folderDao) {
                  return folderDao.id === folderId
                })) {
              clToast('Folder is already in the classeur.')
            }
            var folderDao = clFolderSvc.folderMap[folderId]
            folderDao ? importExistingFolder(folderDao) : importPublicFolder(folderId)
          })
        }

        function createFolder () {
          makeInputDialog('core/explorerLayout/newFolderDialog.html', function (scope) {
            scope.import = function () {
              clDialog.cancel()
              importFolder()
            }
          }).then(function (name) {
            var folderDao = clFolderSvc.createFolder()
            folderDao.name = name
            // Classeurs are updated when evaluating folderSvc.folders
            clExplorerLayoutSvc.currentClasseurDao.folders.push(folderDao)
            $timeout(function () {
              clExplorerLayoutSvc.setCurrentFolder(folderDao)
            })
          })
        }

        function importFile () {
          var classeurDao = clExplorerLayoutSvc.currentClasseurDao
          var folderDao = clExplorerLayoutSvc.currentFolderDao
          clDialog.show({
            templateUrl: 'core/explorerLayout/importFileDialog.html',
            controller: ['$scope', function (scope) {
              scope.cancel = function () {
                clDialog.cancel()
              }
            }]
          })
            .then(function (file) {
              var newFileDao = clFileSvc.createFile()
              newFileDao.state = 'loaded'
              newFileDao.readContent()
              newFileDao.name = file.name
              newFileDao.contentDao.text = file.content
              newFileDao.contentDao.properties = clSettingSvc.values.defaultFileProperties || {}
              newFileDao.writeContent()
              if (folderDao && clFolderSvc.folderMap[folderDao.id]) {
                newFileDao.folderId = folderDao.id
                newFileDao.userId = folderDao.userId
                if (folderDao.userId) {
                  newFileDao.sharing = folderDao.sharing
                }
              } else {
                newFileDao.classeurId = classeurDao.id
              }
              scope.setCurrentFile(newFileDao)
            })
        }

        scope.createFile = function () {
          var classeurDao = clExplorerLayoutSvc.currentClasseurDao
          var folderDao = clExplorerLayoutSvc.currentFolderDao
          makeInputDialog('core/explorerLayout/newFileDialog.html', function (scope) {
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
              newFileDao.contentDao.properties = clSettingSvc.values.defaultFileProperties || {}
              newFileDao.writeContent()
              if (folderDao && clFolderSvc.folderMap[folderDao.id]) {
                newFileDao.folderId = folderDao.id
                newFileDao.userId = folderDao.userId
                if (folderDao.userId) {
                  newFileDao.sharing = folderDao.sharing
                }
              } else {
                newFileDao.classeurId = classeurDao.id
              }
              scope.setCurrentFile(newFileDao)
            })
        }

        // setInterval(function() {
        // 	var fileDao = clFileSvc.createFile()
        // 	fileDao.name = 'File ' + fileDao.id
        // 	fileDao.folderId = clFolderSvc.folders[Math.random() * clFolderSvc.folders.length | 0].id
        // 	scope.$apply()
        // }, 1000)

        // setInterval(function() {
        // 	var folderDao = clFolderSvc.createFolder()
        // 	folderDao.name = 'Folder ' + folderDao.id
        // 	clExplorerLayoutSvc.currentClasseurDao.folders.push(folderDao)
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
          clExplorerLayoutSvc.files.cl_each(function (fileDao) {
            if (!fileDao.isSelected) {
              doAll = false
              fileDao.isSelected = true
            }
          })
          doAll && clExplorerLayoutSvc.extraFiles.cl_each(function (fileDao) {
            fileDao.isSelected = true
          })
        }

        scope.selectNone = function () {
          clExplorerLayoutSvc.selectedFiles.cl_each(function (fileDao) {
            fileDao.isSelected = false
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
              var currentFolderDao = clExplorerLayoutSvc.folders[newIndex] || clExplorerLayoutSvc.unclassifiedFolder
              clExplorerLayoutSvc.setCurrentFolder(currentFolderDao)
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

          scope.deleteFile = function (fileDao) {
            folderToRemove = null
            filesToRemove = [fileDao]
            deleteConfirm()
          }

          scope.deleteConfirm = function (deleteFolder) {
            folderToRemove = null
            if (deleteFolder) {
              folderToRemove = clExplorerLayoutSvc.currentFolderDao
              !clExplorerLayoutSvc.currentFolderDao.userId && scope.selectAll()
            }
            clExplorerLayoutSvc.updateSelectedFiles() // updateSelectedFiles is called automatically but later
            filesToRemove = clExplorerLayoutSvc.selectedFiles
            deleteConfirm()
          }
        })()

        scope.isFolderInOtherClasseur = function () {
          return clClasseurSvc.classeurs.cl_some(function (classeurDao) {
            return classeurDao !== clExplorerLayoutSvc.currentClasseurDao && classeurDao.folders.indexOf(clExplorerLayoutSvc.currentFolderDao) !== -1
          })
        }

        scope.removeFolderFromClasseur = function () {
          if (clExplorerLayoutSvc.currentFolderDao.userId && !scope.isFolderInOtherClasseur()) {
            clFolderSvc.removeFolders([clExplorerLayoutSvc.currentFolderDao])
          } else {
            clExplorerLayoutSvc.currentClasseurDao.folders = clExplorerLayoutSvc.currentClasseurDao.folders.cl_filter(function (folderInClasseur) {
              return folderInClasseur.id !== clExplorerLayoutSvc.currentFolderDao.id
            })
          }
          clClasseurSvc.init()
          clExplorerLayoutSvc.refreshFolders()
        }

        scope.createClasseur = function () {
          makeInputDialog('core/explorerLayout/newClasseurDialog.html')
            .then(function (name) {
              var classeurDao = clClasseurSvc.createClasseur(name)
              scope.setClasseur(classeurDao)
            })
        }

        scope.deleteClasseur = function (classeurDao) {
          var filesToRemove = []
          var foldersToRemove = classeurDao.folders.cl_filter(function (folderDao) {
            if (!clClasseurSvc.classeurs
                .cl_some(function (otherClasseurDao) {
                  return otherClasseurDao !== classeurDao && otherClasseurDao.folders.indexOf(folderDao) !== -1
                })) {
              filesToRemove = filesToRemove.concat(clExplorerLayoutSvc.files.cl_filter(function (fileDao) {
                return fileDao.folderId === folderDao.id
              }))
              return true
            }
          })

          function remove () {
            clClasseurSvc.setDeletedClasseurs([classeurDao])
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

        scope.setClasseur = function (classeurDao) {
          folderListScrollerElt.scrollTop = 0
          clExplorerLayoutSvc.setCurrentClasseur(classeurDao)
          clExplorerLayoutSvc.setCurrentFolder(classeurDao.lastFolder)
          clExplorerLayoutSvc.refreshFolders()
          clExplorerLayoutSvc.toggleExplorer(true)
        }

        scope.signout = function () {
          clUserSvc.signout()
          clExplorerLayoutSvc.toggleExplorer(true)
        }

        function refreshFiles () {
          folderElt.scrollTop = 0
          clExplorerLayoutSvc.moreFiles(true)
          clExplorerLayoutSvc.refreshFiles()
          scope.selectNone()
        }

        scope.$watch('explorerLayoutSvc.isExplorerOpen', animateLayout)
        scope.$watch('fileSvc.files', clExplorerLayoutSvc.refreshFiles)
        scope.$watch('folderSvc.folders', function () {
          clClasseurSvc.init()
          clExplorerLayoutSvc.refreshFolders()
        })
        scope.$watchGroup(['classeurSvc.classeurs', 'classeurSvc.classeurs.length'], function () {
          clExplorerLayoutSvc.refreshFolders()
          scope.classeurIndex = clClasseurSvc.classeurs.indexOf(clExplorerLayoutSvc.currentClasseurDao)
        })
        scope.$watchGroup(['explorerLayoutSvc.currentClasseurDao', 'explorerLayoutSvc.currentFolderDao'], function () {
          scope.userInputFilter = undefined
          refreshFiles()
          scope.classeurIndex = clClasseurSvc.classeurs.indexOf(clExplorerLayoutSvc.currentClasseurDao)
          setPlasticClass()
          clPublicSyncSvc.getFolder(clExplorerLayoutSvc.currentFolderDao)
        })
        scope.$watch('userInputFilter', function (value) {
          clExplorerLayoutSvc.setUserInputFilter(value)
          refreshFiles()
        })
        scope.$watch('explorerLayoutSvc.files', scope.triggerInfiniteScroll)
        scope.$watch('explorerLayoutSvc.currentFolderDao.sharing', clExplorerLayoutSvc.setEffectiveSharing)

        // Refresh selectedFiles on every digest and add 1 cycle when length changes
        scope.$watch('explorerLayoutSvc.updateSelectedFiles().length', function () {})

        scope.$on('$destroy', function () {
          clExplorerLayoutSvc.clean()
        })
      }
    })
  .factory('clExplorerLayoutSvc',
    function ($rootScope, clLocalStorage, clFolderSvc, clFileSvc, clClasseurSvc) {
      var pageSize = 20
      var lastClasseurKey = 'lastClasseurId'
      var lastFolderKey = 'lastFolderId'
      var unclassifiedFolder = {
        id: 'unclassified',
        name: 'My files'
      }
      var createFolder = {
        id: 'create',
        name: 'Create folder'
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

      function inputFilter (fileDao) {
        return !userInputFilter || fileDao.name.toLowerCase().indexOf(userInputFilter) !== -1
      }

      function currentUserFilter (fileDao) {
        return !fileDao.userId
      }

      function currentFolderFilter (fileDao) {
        return fileDao.folderId === clExplorerLayoutSvc.currentFolderDao.id
      }

      function refreshFiles () {
        var filters = []
        var files = clFileSvc.files
        var extraFiles = []

        function currentClasseurFilter (fileDao) {
          var result = clExplorerLayoutSvc.currentClasseurDao.isDefault
          var classeurDao = clClasseurSvc.classeurMap[fileDao.classeurId]
          if (classeurDao) {
            result = classeurDao === clExplorerLayoutSvc.currentClasseurDao
          } else if (clFolderSvc.folderMap[fileDao.folderId]) {
            result = clExplorerLayoutSvc.currentClasseurDao.folders.cl_some(function (folderDao) {
              return folderDao.id === fileDao.folderId
            })
          }
          !result && extraFiles.push(fileDao)
          return result
        }

        if (clExplorerLayoutSvc.currentFolderDao === unclassifiedFolder) {
          filters.push(currentUserFilter)
          filters.push(inputFilter)
          filters.push(currentClasseurFilter)
        } else if (clExplorerLayoutSvc.currentFolderDao) {
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
        if (!clExplorerLayoutSvc.currentFolderDao) {
          // Sort by local content change (recent files)
          sort = function (fileDao1, fileDao2) {
            return fileDao2.contentDao.lastChange - fileDao1.contentDao.lastChange
          }
        } else if (clExplorerLayoutSvc.isSortedByDate) {
          // Sort by server change
          sort = function (fileDao1, fileDao2) {
            return fileDao2.updated - fileDao1.updated
          }
        } else {
          // Sort by name
          sort = function (fileDao1, fileDao2) {
            return fileDao1.name.localeCompare(fileDao2.name)
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
        clExplorerLayoutSvc.selectedFiles = clExplorerLayoutSvc.files.cl_filter(function (fileDao) {
          return fileDao.isSelected
        }).concat(clExplorerLayoutSvc.extraFiles.cl_filter(function (fileDao) {
          return fileDao.isSelected
        }))
        return clExplorerLayoutSvc.selectedFiles
      }

      function setEffectiveSharing () {
        if (clExplorerLayoutSvc.currentFolderDao) {
          clExplorerLayoutSvc.currentFolderDao.effectiveSharing = clExplorerLayoutSvc.currentFolderDao.sharing
        }
        clExplorerLayoutSvc.files.concat(clExplorerLayoutSvc.extraFiles).cl_each(function (fileDao) {
          fileDao.effectiveSharing = fileDao.sharing
          var folderDao = clFolderSvc.folderMap[fileDao.folderId]
          if (folderDao && folderDao.sharing > fileDao.sharing) {
            fileDao.effectiveSharing = folderDao.sharing
          }
        })
      }

      function refreshFolders () {
        setCurrentClasseur(clExplorerLayoutSvc.currentClasseurDao)
        setCurrentFolder(clExplorerLayoutSvc.currentFolderDao)
        clExplorerLayoutSvc.folders = clExplorerLayoutSvc.currentClasseurDao.folders.slice().sort(function (folder1, folder2) {
          return folder1.name.localeCompare(folder2.name)
        })
      }

      function setCurrentClasseur (classeurDao) {
        classeurDao = (classeurDao && clClasseurSvc.classeurMap[classeurDao.id]) || clClasseurSvc.defaultClasseur
        clExplorerLayoutSvc.currentClasseurDao = classeurDao
        clLocalStorage.setItem(lastClasseurKey, classeurDao.id)
      }

      function setCurrentFolder (folderDao) {
        folderDao = folderDao === unclassifiedFolder ? folderDao : (folderDao && clFolderSvc.folderMap[folderDao.id])
        if (folderDao && folderDao !== unclassifiedFolder && clExplorerLayoutSvc.currentClasseurDao.folders.indexOf(folderDao) === -1) {
          folderDao = undefined
        }
        clExplorerLayoutSvc.currentFolderDao = folderDao
        clExplorerLayoutSvc.currentClasseurDao.lastFolder = folderDao
        folderDao && folderDao.id ? clLocalStorage.setItem(lastFolderKey, folderDao.id) : clLocalStorage.removeItem(lastFolderKey)
      }

      function setCurrentFolderInClasseur (folderDao) {
        if (!clClasseurSvc.classeurs
            .cl_some(function (classeurDao) {
              if (classeurDao.folders.indexOf(folderDao) !== -1) {
                setCurrentClasseur(classeurDao)
                return true
              }
            })) {
          setCurrentClasseur(clClasseurSvc.defaultClasseur)
        }
        setCurrentFolder(folderDao)
        clExplorerLayoutSvc.refreshFolders()
      }

      var clExplorerLayoutSvc = {
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
        init: function () {
          this.isExplorerOpen = true
        },
        clean: function () {
          clExplorerLayoutSvc.sharingDialogFileDao = undefined
        },
        toggleExplorer: function (isOpen) {
          this.isExplorerOpen = isOpen === undefined ? !this.isExplorerOpen : isOpen
        }
      }

      setCurrentClasseur(clClasseurSvc.classeurMap[clLocalStorage[lastClasseurKey]])
      setCurrentFolder(clFolderSvc.folderMap[clLocalStorage[lastFolderKey]])
      moreFiles(true)

      return clExplorerLayoutSvc
    })
