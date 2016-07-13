angular.module('classeur.optional.quotaDialog', [])
  .run(function (clDialog, clFileSvc, clUserSvc) {
    var createFile = clFileSvc.createFile
    clFileSvc.createFile = function () {
      if (clUserSvc.user && !~clUserSvc.user.roles.indexOf('premium_user') && clFileSvc.activeDaos
          .cl_filter(function (dao) {
            return !dao.userId
          }).length >= 100) {
        return clDialog.show({
          templateUrl: 'optional/quotaDialog/quotaDialog.html',
          onComplete: function (scope) {
            scope.close = function () {
              clDialog.cancel()
            }
          }
        })
      }
      return createFile.apply(clFileSvc, arguments)
    }
  })
