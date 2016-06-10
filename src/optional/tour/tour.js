angular.module('classeur.optional.tour', [])
  .directive('clTour',
    function ($timeout, clDialog, clLocalSettingSvc) {
      return {
        restrict: 'E',
        link: link
      }

      function link () {
        if (!clLocalSettingSvc.values.explorerTourStep || !clLocalSettingSvc.values.editorTourStep) {
          $timeout(function () {
            clDialog.show({
              templateUrl: 'optional/tour/tourDialog.html',
              onComplete: function (scope) {
                scope.start = function () {
                  clDialog.hide()
                }
              }
            }).then(function () {
              clLocalSettingSvc.values.explorerTourStep = 1
              clLocalSettingSvc.values.editorTourStep = 1
            })
          }, 100)
        }
      }
    })
  .directive('clTourStep',
    function ($timeout) {
      return {
        restrict: 'A',
        link: link
      }

      function link (scope, element, attr) {
        var timeoutId
        scope.show = false
        scope.$watch(attr.clTourStep, function (value) {
          $timeout.cancel(timeoutId)
          if (value) {
            timeoutId = $timeout(function () {
              scope.show = true
            }, 500)
          } else {
            scope.show = false
          }
        })
      }
    })
  .directive('clExplorerTourNext',
    function (clLocalSettingSvc) {
      return {
        restrict: 'A',
        link: link
      }

      function link (scope, element, attr) {
        element.on('click', function () {
          var nextStep = parseInt(attr.clExplorerTourNext, 10)
          if (isNaN(nextStep) || clLocalSettingSvc.values.explorerTourStep === nextStep - 1) {
            clLocalSettingSvc.values.explorerTourStep++
            scope.$evalAsync()
          }
        })
      }
    })
  .directive('clEditorTourNext',
    function (clLocalSettingSvc) {
      return {
        restrict: 'A',
        link: link
      }

      function link (scope, element, attr) {
        element.on('click', function () {
          var nextStep = parseInt(attr.clEditorTourNext, 10)
          if (isNaN(nextStep) || clLocalSettingSvc.values.editorTourStep === nextStep - 1) {
            clLocalSettingSvc.values.editorTourStep++
            scope.$evalAsync()
          }
        })
      }
    })
