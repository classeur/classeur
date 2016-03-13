angular.module('classeur.optional.quotaDialog', [])
  .run(function ($rootScope, clDialog) {
    $rootScope.$on('clTooManyRequests', function () {
      clDialog.show({
        templateUrl: 'optional/quotaDialog/quotaDialog.html',
        onComplete: function (scope) {
          scope.close = function () {
            clDialog.cancel()
          }
        }
      })
    })
  })
