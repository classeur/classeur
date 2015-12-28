angular.module('classeur.optional.fileHistory', [])
  .directive('clFileHistoryTab',
    function (clFileHistorySvc, clContentSyncSvc, clDiffUtils) {
      return {
        restrict: 'E',
        scope: true,
        templateUrl: 'optional/fileHistory/fileHistoryTab.html',
        link: link
      }

      function link (scope) {
        scope.fileHistorySvc = clFileHistorySvc

        scope.selectChangeGroup = function (changeGroup) {
          if (clFileHistorySvc.selectedChangeGroup !== changeGroup) {
            clFileHistorySvc.selectedChangeGroup = changeGroup
          } else {
            clFileHistorySvc.selectedChangeGroup = undefined
          }
        }

        scope.$watchGroup(['fileHistorySvc.selectedChangeGroup', 'fileHistorySvc.changeGroups'], function () {
          scope.diffs = undefined
          var changeGroup = clFileHistorySvc.selectedChangeGroup
          if (changeGroup) {
            if (clFileHistorySvc.changeGroups.indexOf(changeGroup) === -1) {
              clFileHistorySvc.selectedChangeGroup = undefined
            } else {
              clContentSyncSvc.retrieveRevision(changeGroup.fromRev)
                .then(function (result1) {
                  return clContentSyncSvc.retrieveRevision(changeGroup.toRev)
                    .then(function (result2) {
                      if (changeGroup === clFileHistorySvc.selectedChangeGroup) {
                        scope.diffs = {
                          text: clDiffUtils.getTextPatches(result1.text, result2.text)
                        }
                      }
                    })
                })
            }
          }
        })
      }
    })
  .directive('clFileHistoryItem',
    function () {
      return {
        restrict: 'E',
        templateUrl: 'optional/fileHistory/fileHistoryItem.html',
        link: link
      }

      function link (scope) {
        scope.revision = ['rev ' + scope.changeGroup.toRev]
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
