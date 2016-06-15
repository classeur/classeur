angular.module('classeur.optional.tour', [])
  .directive('clTourStep',
    function ($timeout, clLocalSettingSvc) {
      if (!clLocalSettingSvc.values.explorerTourStep || !clLocalSettingSvc.values.editorTourStep) {
        clLocalSettingSvc.values.explorerTourStep = 1
        clLocalSettingSvc.values.editorTourStep = 1
      }

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
