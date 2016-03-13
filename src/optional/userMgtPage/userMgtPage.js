angular.module('classeur.optional.userMgtPage', [])
  .config(
    function ($routeProvider) {
      $routeProvider
        .when('/users', {
          template: '<cl-user-mgt-page></cl-user-mgt-page>',
          controller: function (clAnalytics) {
            clAnalytics.trackPage('/users')
          }
        })
    })
  .directive('clUserMgtPage',
    function (clRestSvc, $location, clToast, clDialog) {
      return {
        restrict: 'E',
        templateUrl: 'optional/userMgtPage/userMgtPage.html',
        link: link
      }

      function link (scope) {
        scope.properties = []
        scope.deleteRow = function (userToDelete) {
          var confirmDialog = clDialog.confirm()
            .title('Delete user')
            .content("Your about to delete a user and all his files. This can't be undone. Are you sure?")
            .ariaLabel('Delete user')
            .ok('Yes, delete all')
            .cancel('No')
          clDialog.show(confirmDialog).then(function () {
            userToDelete.isDeleting = true
            clRestSvc.request({
              method: 'DELETE',
              url: '/api/v2/users/' + userToDelete.id
            })
              .then(function () {
                scope.users = scope.users.cl_filter(function (user) {
                  return user.id !== userToDelete.id
                })
                scope.$evalAsync()
              })
              .catch(function (err) {
                userToDelete.isDeleting = false
                clToast('Error: ' + (err && err.reason) || 'unknown')
              })
          })
        }

        scope.$watch(function () {
          return scope.users && JSON.stringify(scope.users.cl_map(function (user) {
            return [
              user.isAdmin,
              user.newForcePremium
            ]
          }))
        }, function () {
          scope.users && scope.users.cl_each(function (user) {
            if (user.isAdmin !== (user.roles.indexOf('admin') !== -1) || user.newForcePremium !== user.forcePremium) {
              var newRoles = user.isAdmin ? ['admin'] : []
              clRestSvc.request({
                method: 'PATCH',
                url: '/api/v1/users/' + user.id,
                body: {
                  roles: user.isAdmin ? ['admin'] : [],
                  forcePremium: user.newForcePremium
                }
              })
              user.roles = newRoles
            }
          })
        })

        var countShow = 0
        function retrieveUsers () {
          return clRestSvc.list('/api/v2/users', { view: 'private' })
            .then(function (res) {
              res.sort(function (user1, user2) {
                return user1.name - user2.name
              }).cl_each(function (user) {
                user.isAdmin = user.roles.indexOf('admin') !== -1
                user.isPremium = user.roles.indexOf('premium_user') !== -1
                user.newForcePremium = user.forcePremium
                user.gravatarHash = user.gravatarHash || '00000000000000000000000000000000'
              })

              countShow = 0
              scope.users = []
              scope.showMore = function () {
                var filter = scope.filter && scope.filter.toLowerCase()
                var filteredUsers = res.filter(function (user) {
                  if (!filter) {
                    return true
                  }
                  return user.id.toLowerCase().indexOf(filter) !== -1 || user.name.toLowerCase().indexOf(filter) !== -1
                })
                if (countShow < filteredUsers.length) {
                  countShow += 20
                  scope.users = filteredUsers.slice(0, countShow)
                  return true
                }
              }
              scope.showMore()
              scope.$evalAsync()
            })
            .catch(function (err) {
              clToast('Error: ' + (err && err.reason) || 'unknown')
            })
        }

        scope.$watch('filter', function () {
          countShow = 0
          scope.users = []
          scope.showMore && scope.showMore()
        })

        retrieveUsers()
      }
    })
