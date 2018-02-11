angular.module('classeur.optional.warningDialog', [])
  .run(function ($timeout, $window, clDialog, clFileSvc, clFolderSvc, clRestSvc, clToast) {
    $timeout(function () {
      clDialog.show({
        templateUrl: 'optional/warningDialog/warningDialog.html',
        onComplete: function (scope) {
          scope.close = function () {
            clDialog.cancel()
          }

          scope.makeBackup = function () {
            clToast('Creating backup...')

            var filesToLoad = clFileSvc.activeDaos.slice()
            var backup = {}

            clFolderSvc.activeDaos.cl_each(function (folder) {
              backup[folder.id] = {
                type: 'folder',
                name: folder.name
              }
            })

            function addContent (file, content) {
              backup[file.id] = {
                type: 'file',
                name: file.name,
                parentId: file.folderId || undefined
              }
              var contentId = file.id + '/content'
              backup[contentId] = {
                type: 'content',
                text: content.text
              }
            }

            function loadOneContent () {
              var fileToLoad = filesToLoad.pop()
              if (fileToLoad) {
                try {
                  fileToLoad.readContent()
                  addContent(fileToLoad, fileToLoad.content)
                  return loadOneContent()
                } catch (e) {
                  // Content is not local, download it
                  return clRestSvc.request({
                    method: 'GET',
                    url: '/api/v2/files/' + fileToLoad.id + '/contentRevs/last'
                  })
                    .then(function (res) {
                      backup[fileToLoad.id] = {
                        type: 'file',
                        name: fileToLoad.name,
                        parentId: fileToLoad.folderId || undefined
                      }
                      var contentId = fileToLoad.id + '/content'
                      backup[contentId] = {
                        type: 'content',
                        text: res.body.text
                      }
                      return loadOneContent()
                    })
                    .catch(function () {
                      return loadOneContent()
                    })
                }
              }
              var blob = new $window.Blob([JSON.stringify(backup)], {
                type: 'application/json'
              })
              $window.saveAs(blob, 'Classeur backup.json')
            }

            loadOneContent()
          }
        }
      })
    }, 3000)
  })
