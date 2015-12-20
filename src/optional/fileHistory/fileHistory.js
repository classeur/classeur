angular.module('classeur.optional.fileHistory', [])
  .directive('clFileHistoryTab',
    function (clFileHistorySvc) {
      return {
        restrict: 'E',
        scope: true,
        templateUrl: 'optional/fileHistory/fileHistoryTab.html',
        link: link
      }

      function link (scope) {
        scope.fileHistorySvc = clFileHistorySvc
      }
    })
  .directive('clFileHistoryItem',
    function (clContentSyncSvc, clDiffUtils) {
      return {
        restrict: 'E',
        templateUrl: 'optional/fileHistory/fileHistoryItem.html',
        link: link
      }

      function link (scope) {
        scope.revision = ['rev ' + scope.changeGroup.toRev]

        scope.selectRevision = function () {
          return clContentSyncSvc.retrieveRevision(scope.changeGroup.fromRev)
            .then(function (result1) {
              return clContentSyncSvc.retrieveRevision(scope.changeGroup.toRev)
                .then(function (result2) {
                  console.log(clDiffUtils.getTextPatches(result1.text, result2.text))
                })
            })
        }
      }
    })
  .factory('clFileHistorySvc',
    function (clSocketSvc) {
      var clFileHistorySvc = {}
      clSocketSvc.addMsgHandler('watchedFile', function (msg) {
        if (msg.content) {
          clFileHistorySvc.changeGroups = msg.content.changeGroups.slice().sort(function (group1, group2) {
            return group2.toRev - group1.toRev
          })
        }
      })
      return clFileHistorySvc
    })
