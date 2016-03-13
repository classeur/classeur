angular.module('classeur.optional.helpDialog', [])
  .run(function ($rootScope, clDialog, clVersion) {
    $rootScope.$on('clHelpDialog', function () {
      clDialog.show({
        templateUrl: 'optional/helpDialog/helpDialog.html',
        onComplete: function (scope) {
          scope.version = clVersion.classeur
          scope.close = function () {
            clDialog.cancel()
          }
        }
      })
    })
  })
