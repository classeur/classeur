angular.module('classeur.optional.readOnlyAlert', [])
  .directive('clReadOnlyAlert',
    function (clEditorLayoutSvc, clUserSvc, clSocketSvc, clEditorContentSvc) {
      return {
        restrict: 'E',
        scope: true,
        template: '<cl-read-only-alert-panel ng-if="editorLayoutSvc.currentControl === \'readOnlyAlert\'"></cl-read-only-alert-panel><cl-write-premium-alert-panel ng-if="editorLayoutSvc.currentControl === \'writePremiumAlert\'"></cl-write-premium-alert-panel>',
        link: link
      }

      function link (scope) {
        var wasDismissed

        scope.dismiss = function () {
          wasDismissed = true
          clEditorLayoutSvc.currentControl = undefined
        }

        var text
        if (scope.currentFile.userId) {
          scope.$watch('currentFile.content.text', function (newtext) {
            if (text === undefined || !scope.currentFile) {
              text = newtext
              return
            }
            if (wasDismissed) {
              return
            }
            if (clEditorContentSvc.lastChange - clEditorContentSvc.lastExternalChange < 1500) {
              return
            }
            if (scope.currentFile.sharing !== 'rw') {
              clEditorLayoutSvc.currentControl = 'readOnlyAlert'
              return
            }
            if (!clSocketSvc.hasToken) {
              clEditorLayoutSvc.currentControl = 'writePremiumAlert'
              return
            }
          })
        }
      }
    })
  .directive('clReadOnlyAlertPanel',
    function () {
      return {
        restrict: 'E',
        templateUrl: 'optional/readOnlyAlert/readOnlyAlertPanel.html'
      }
    })
  .directive('clWritePremiumAlertPanel',
    function () {
      return {
        restrict: 'E',
        templateUrl: 'optional/readOnlyAlert/writePremiumAlertPanel.html'
      }
    })
