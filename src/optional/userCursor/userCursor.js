angular.module('classeur.optional.userCursor', [])
  .directive('clUserCursor',
    function ($window, $timeout, $rootScope, clUserInfoSvc, clEditorSvc, clEditorClassApplier, clContentSyncSvc) {
      var styleElt = $window.document.createElement('style')
      styleElt.type = 'text/css'
      $window.document.getElementsByTagName('head')[0].appendChild(styleElt)
      var userClasses = Object.create(null)

      function refreshClasses () {
        var styleContent = ''
        Object.keys(userClasses).cl_each(function (userId) {
          var userInfo = clUserInfoSvc.users[userId] || {}
          var name = userInfo.name || '?'
          var color = userInfo.color || '888'
          styleContent += '.user-cursor-' + userId + ' {'
          styleContent += '-webkit-box-shadow: inset -2px 0 #' + color + ';'
          styleContent += 'box-shadow: inset -2px 0 #' + color + '}'
          var escapedUsername = name.replace(/[\s\S]/g, function (character) {
            var escape = character.charCodeAt().toString(16)
            return '\\' + ('000000' + escape).slice(-6)
          })
          styleContent += '.user-cursor-' + userId + '::after {'
          styleContent += 'background-color: #' + color + ';'
          styleContent += "content: '" + escapedUsername + "';"
        })
        styleElt.innerHTML = styleContent
      }

      function createUserClass (userId) {
        if (!userClasses[userId]) {
          userClasses[userId] = true
          refreshClasses()
        }
      }

      $rootScope.$watch('userInfoSvc.lastUserInfo', refreshClasses)

      var Marker = $window.cledit.Marker
      var id = 0

      return {
        restrict: 'E',
        link: link
      }

      function link (scope) {
        createUserClass(scope.userId)
        var classApplier, marker, timeoutId

        function unsetHighlighting () {
          marker && clEditorSvc.cledit.removeMarker(marker)
          classApplier && classApplier.stop()
          $timeout.cancel(timeoutId)
        }

        function highlightOffset (offset) {
          unsetHighlighting()
          if (!offset) {
            return
          }
          marker = new Marker(offset.end)
          clEditorSvc.cledit.addMarker(marker)
          classApplier = clEditorClassApplier(['user-cursor' + id++, 'user-cursor-' + scope.userId, 'user-cursor'], function () {
            var offset = marker.offset
            var content = clEditorSvc.cledit.getContent()
            while (content[offset - 1] === '\n') {
              offset--
            }
            return offset > 0 && {
              start: offset - 1,
              end: offset
            }
          })
          timeoutId = $timeout(function () {
            if (clContentSyncSvc.watchCtx) {
              delete clContentSyncSvc.watchCtx.userCursors[scope.userId]
            }
          }, 30000)
        }
        scope.$watch('userCursor.offset', highlightOffset)

        scope.$on('$destroy', function () {
          unsetHighlighting()
        })
      }
    })
