angular.module('classeur.optional.spinner', [])
  .directive('clCenteredSpinner', function () {
    return {
      restrict: 'E',
      scope: true,
      template: '<div class="cl-panel" layout="row" layout-align="center center"><cl-spinner></cl-spinner></div>'
    }
  })
  .directive('clSpinner', function () {
    return {
      restrict: 'E',
      scope: true,
      template: '<md-progress-circular class="md-accent md-hue-2" md-mode="indeterminate" md-diameter="60"></md-progress-circular>'
    }
  })
