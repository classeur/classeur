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
                refreshCount()
                scope.$evalAsync()
              })
              .catch(function (err) {
                userToDelete.isDeleting = false
                clToast('Error: ' + (err && err.message) || 'unknown')
              })
          })
        }

        scope.switchDisable = function (user) {
          var disabled = !user.disabled
          function doSwitch () {
            user.isDisabling = true
            clRestSvc.request({
              method: 'PATCH',
              url: '/api/v1/users/' + user.id,
              body: {
                disabled: disabled
              }
            })
              .then(function () {
                user.isDisabling = false
                user.disabled = disabled
                refreshCount()
                scope.$evalAsync()
              })
              .catch(function (err) {
                user.isDisabling = false
                clToast('Error: ' + (err && err.message) || 'unknown')
              })
          }
          if (user.disabled) {
            return doSwitch()
          }
          var confirmDialog = clDialog.confirm()
            .title('Disable user')
            .content("User won't be able to sign in but his files will still be accessible.")
            .ariaLabel('Disable user')
            .ok('Ok')
            .cancel('Cancel')
          clDialog.show(confirmDialog).then(doSwitch)
        }

        scope.$watch(function () {
          return scope.users && JSON.stringify(scope.users.cl_map(function (user) {
            return [
              user.isAdmin,
              user.newForcePremium
            ]
          }))
        }, function () {
          refreshCount()
          scope.users && scope.users.cl_each(function (user) {
            if (user.isAdmin !== (user.roles.indexOf('admin') !== -1) || user.newForcePremium !== user.forcePremium) {
              var newRoles = user.isAdmin ? ['admin'] : []
              clRestSvc.request({
                method: 'PATCH',
                url: '/api/v1/users/' + user.id,
                body: {
                  roles: newRoles,
                  forcePremium: user.newForcePremium
                }
              })
              user.roles = newRoles
            }
          })
        })

        var users
        function refreshCount () {
          if (users) {
            scope.count = users.length
            scope.enabledCount = 0
            scope.premiumCount = 0
            scope.adminCount = 0
            users.cl_each(function (user) {
              user.filterable = user.id.toLowerCase() + user.name.toLowerCase() + user.roles.join('')
              if (!user.disabled) {
                scope.enabledCount++
              }
              if (user.isPremium) {
                scope.premiumCount++
              }
              if (user.isAdmin) {
                scope.adminCount++
              }
            }, 0)
          }
        }

        var countShow = 0
        function retrieveUsers () {
          return clRestSvc.list('/api/v2/users', { view: 'private' })
            .then(function (res) {
              users = res
              refreshCount()
              users.sort(function (user1, user2) {
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
                var filteredUsers = users.filter(function (user) {
                  return !filter || ~user.filterable.indexOf(filter)
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
              clToast('Error: ' + (err && err.message) || 'unknown')
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
