angular.module('classeur.optional.spinner', [])
  .directive('clBlockSpinner', function () {
    return {
      restrict: 'E',
      scope: true,
      template: '<div layout="row" layout-align="center center"><cl-spinner></cl-spinner></div>'
    }
  })
  .directive('clCenteredSpinner', function () {
    return {
      restrict: 'E',
      scope: true,
      template: '<div class="panel" layout="row" layout-align="center center"><cl-spinner></cl-spinner></div>'
    }
  })
  .directive('clSpinner', function () {
    return {
      restrict: 'E',
      scope: true,
      template: '<md-progress-circular class="md-accent md-hue-2" md-mode="indeterminate" md-diameter="80"></md-progress-circular>'
    }
  })
