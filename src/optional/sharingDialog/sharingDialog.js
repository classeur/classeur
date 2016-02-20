angular.module('classeur.optional.sharingDialog', [])
  .directive('clSharingDialog',
    function ($location, clDialog, clConfig, clUserSvc, clEditorLayoutSvc, clExplorerLayoutSvc, clUrl, clFolderSvc, clUserInfoSvc) {
      return {
        restrict: 'E',
        link: link
      }

      function link (scope) {
        function closeDialog () {
          clEditorLayoutSvc.currentControl = undefined
          clExplorerLayoutSvc.sharingDialogFileDao = undefined
          clExplorerLayoutSvc.sharingDialogFolderDao = undefined
        }

        function showDialog (objectDao, sharingUrl, isFile, folder) {
          clDialog.show({
            templateUrl: 'optional/sharingDialog/sharingDialog.html',
            controller: ['$scope', function (scope) {
              scope.isFile = isFile
              scope.objectDao = objectDao
              scope.folder = folder
              scope.encodedSharingUrl = encodeURIComponent(sharingUrl)
              scope.encodedName = encodeURIComponent(objectDao.name)
              scope.sharingUrl = sharingUrl
            }],
            onComplete: function (scope, element) {
              scope.userInfoSvc = clUserInfoSvc
              scope.openFolder = function () {
                clDialog.hide()
              }
              scope.close = function () {
                clDialog.cancel()
              }

              var inputElt = element[0].querySelector('input.url')

              function select () {
                setTimeout(function () {
                  inputElt.setSelectionRange(0, sharingUrl.length)
                }, 100)
              }
              inputElt.addEventListener('focus', select)
              inputElt.addEventListener('click', select)
              inputElt.addEventListener('keyup', select)
              scope.$watch('objectDao.effectiveSharing', function () {
                if (!objectDao.userId) {
                  if (!isFile || !folder || folder.sharing < objectDao.effectiveSharing) {
                    objectDao.sharing = objectDao.effectiveSharing
                  } else {
                    objectDao.sharing = ''
                  }
                }
              })
              scope.$watch('sharingUrl', function () {
                scope.sharingUrl = sharingUrl
                select()
              })
            }
          }).then(function () {
            closeDialog()
            if (folder) {
              showFolderDialog(folder)
            }
          }, closeDialog)
        }

        function showFileDialog (file, anchor) {
          var folder = clFolderSvc.daoMap[file.folderId]
          file.effectiveSharing = file.sharing
          if (folder && folder.sharing > file.sharing) {
            file.effectiveSharing = folder.sharing
          }
          var sharingUrl = clConfig.appUri + '/#!' + clUrl.file(file, clUserSvc.user)
          if (anchor) {
            sharingUrl += '#' + anchor
          }
          showDialog(file, sharingUrl, true, folder)
        }

        function showFolderDialog (folder) {
          folder.effectiveSharing = folder.sharing
          var sharingUrl = clConfig.appUri + '/#!' + clUrl.folder(folder, clUserSvc.user)
          showDialog(folder, sharingUrl)
        }

        scope.$watch('editorLayoutSvc.currentControl', function (currentControl) {
          var split = (currentControl || '').split('#')
          if (split[0] === 'sharingDialog') {
            if (scope.currentFile.isLocalFile) {
              var createCopyDialog = clDialog.confirm()
                .title('Sharing')
                .content("Hard drive file can't be shared. Please make a copy in your Classeur.")
                .ariaLabel('Sharing')
                .ok('Make a copy')
                .cancel('Cancel')
              clDialog.show(createCopyDialog).then(function () {
                closeDialog()
                scope.makeCurrentFileCopy()
              }, closeDialog)
            } else if (!clUserSvc.user) {
              var signinDialog = clDialog.confirm()
                .title('Sharing')
                .content('Please sign in to turn on file sharing.')
                .ariaLabel('Sharing')
                .ok(clConfig.loginForm ? 'Sign in' : 'Sign in with Google')
                .cancel('Cancel')
              clDialog.show(signinDialog).then(function () {
                closeDialog()
                if (clConfig.loginForm) {
                  $location.url('/signin')
                } else {
                  clUserSvc.startOAuth()
                }
              }, closeDialog)
            } else {
              showFileDialog(scope.currentFile, split[1])
            }
          }
        })
        scope.$watch('explorerLayoutSvc.sharingDialogFileDao', function (file) {
          file && showFileDialog(file)
        })
        scope.$watch('explorerLayoutSvc.sharingDialogFolderDao', function (folder) {
          folder && showFolderDialog(folder)
        })
      }
    })
