angular.module('classeur.optional.fileDragging', [])
  .directive('clFileDraggingSrc',
    function ($window, clFileDraggingSvc, clExplorerLayoutSvc) {
      var Hammer = $window.Hammer
      var bodyElt = angular.element($window.document.body)
      return {
        restrict: 'A',
        link: link
      }

      function link (scope, element) {
        function movePanel (evt) {
          evt.preventDefault()
          clFileDraggingSvc.panelElt.clanim
            .translateX(evt.center.x + 10)
            .translateY(evt.center.y)
            .start()
        }
        var hammertime = new Hammer(element[0])
        hammertime.get('pan').set({
          direction: Hammer.DIRECTION_ALL,
          threshold: 0
        })
        hammertime.on('panstart', function (evt) {
          clFileDraggingSvc.setTargetFolder()
          clFileDraggingSvc.setFileSrc(scope.file)
          clFileDraggingSvc.panelElt.clanim
            .width(clExplorerLayoutSvc.explorerWidth - clExplorerLayoutSvc.scrollbarWidth - (clExplorerLayoutSvc.noPadding ? 90 : 210))
            .start()
          movePanel(evt)
          bodyElt.addClass('body--file-dragging')
          scope.$apply()
        })
        hammertime.on('panmove', function (evt) {
          movePanel(evt)
        })
        hammertime.on('panend', function () {
          clFileDraggingSvc.moveFiles()
          clFileDraggingSvc.files = []
          clFileDraggingSvc.setTargetFolder()
          bodyElt.removeClass('body--file-dragging')
          scope.$apply()
        })
      }
    })
  .directive('clFileDraggingTarget',
    function (clFileDraggingSvc, clExplorerLayoutSvc) {
      return {
        restrict: 'A',
        link: link
      }

      function link (scope, element) {
        if (scope.folder === clExplorerLayoutSvc.createFolder) {
          return
        }
        element[0].addEventListener('mouseenter', function () {
          if (clFileDraggingSvc.files.length) {
            clFileDraggingSvc.setTargetFolder(scope.folder)
          }
        })
        element[0].addEventListener('mouseleave', function () {
          if (clFileDraggingSvc.targetFolder === scope.folder) {
            clFileDraggingSvc.setTargetFolder()
          }
        })
      }
    })
  .directive('clFileDragging',
    function (clFileDraggingSvc) {
      return {
        restrict: 'E',
        templateUrl: 'optional/fileDragging/fileDragging.html',
        link: link
      }

      function link (scope, element) {
        scope.fileDraggingSvc = clFileDraggingSvc
        clFileDraggingSvc.panelElt = element[0].querySelector('.file-dragging')
      }
    })
  .factory('clFileDraggingSvc',
    function (clDialog, clExplorerLayoutSvc, clToast) {
      function setFileSrc (file) {
        clFileDraggingSvc.files = file.isSelected ? clExplorerLayoutSvc.files.cl_filter(function (file) {
          return !file.userId && file.isSelected
        }).concat(clExplorerLayoutSvc.extraFiles.cl_filter(function (file) {
          return !file.userId && file.isSelected
        })) : [file]
      }

      function setTargetFolder (folder) {
        clFileDraggingSvc.targetFolder = folder
      }

      function doMoveFiles (targetFolder, files) {
        var targetFolderId = targetFolder.id
        if (targetFolder === clExplorerLayoutSvc.unclassifiedFolder) {
          targetFolderId = ''
        }
        files = files.cl_filter(function (file) {
          if (file.folderId !== targetFolderId) {
            file.folderId = targetFolderId
            file.userId = targetFolder.userId
            return true
          }
        })
        if (files.length) {
          clExplorerLayoutSvc.refreshFiles()
          var msg = files.length
          msg += msg > 1 ? ' files moved to ' : ' file moved to '
          msg += targetFolder.name + '.'
          clToast(msg)
        }
      }

      function moveFiles () {
        if (clFileDraggingSvc.targetFolder && clFileDraggingSvc.targetFolder !== clExplorerLayoutSvc.currentFolder) {
          var files = clFileDraggingSvc.files
          var targetFolder = clFileDraggingSvc.targetFolder
          if (clFileDraggingSvc.targetFolder.userId) {
            if (clFileDraggingSvc.targetFolder.sharing === 'rw') {
              var title = 'Change ownership'
              var confirm = clDialog.confirm()
                .title(title)
                .ariaLabel(title)
                .content("You're about to change the ownership of your file(s). Are you sure?")
                .ok('Yes')
                .cancel('No')
              return clDialog.show(confirm).then(function () {
                doMoveFiles(targetFolder, files)
              })
            } else {
              return clToast("Can't move files to read only folder.")
            }
          }
          doMoveFiles(targetFolder, files)
        }
      }

      var clFileDraggingSvc = {
        files: [],
        setFileSrc: setFileSrc,
        setTargetFolder: setTargetFolder,
        moveFiles: moveFiles
      }
      return clFileDraggingSvc
    })
