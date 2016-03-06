angular.module('classeur.optional.settingsPage', [])
  .config(
    function ($routeProvider) {
      $routeProvider.when('/settings', {
        title: 'Settings',
        template: '<cl-settings-page></cl-settings-page>',
        reloadOnSearch: false,
        controller: function (clAnalytics) {
          clAnalytics.trackPage('/settings')
        }
      })
    })
  .directive('clSettingsPage',
    function ($window, $rootScope, $timeout, $location, clDialog, clUserSvc, clToast, clStateMgr, clSocketSvc, clSyncSvc, clFileSvc, clSettingSvc, clFilePropertiesDialog, clTemplateManagerDialog, clBlogSvc, clRestSvc) {
      var trashPageSize = 25

      clSocketSvc.addMsgHandler('linkedUser', function (msg) {
        clToast(msg.error ? 'An error occurred.' : 'Account successfully linked.')
      })

      clSocketSvc.addMsgHandler('linkBlogToken', function (msg) {
        clBlogSvc.startOAuth(msg.blog, msg.token)
      })

      clSocketSvc.addMsgHandler('deletedUser', function () {
        $location.url('/')
        $rootScope.$apply()
        clUserSvc.signout()
        $rootScope.$apply()
      })

      return {
        restrict: 'E',
        templateUrl: 'optional/settingsPage/settingsPage.html',
        link: link
      }

      function link (scope) {
        var tabs = ['app', 'user', 'blogs', 'trash']

        var waitForSocketReady = (function () {
          var watcher
          var watchCb
          return function (cb) {
            watchCb = cb
            if (!watcher) {
              watcher = scope.$watch('socketSvc.isReady', function (isReady) {
                if (isReady) {
                  watcher()
                  watcher = undefined
                  watchCb()
                }
              })
            }
          }
        })()

        scope.loadDefault = function () {
          clDialog.show(clDialog.confirm()
            .title('Reset app settings')
            .content("You're about to reset your app settings. Are you sure?")
            .ok('Yes')
            .cancel('No'))
            .then(function () {
              clSettingSvc.values = JSON.parse(clSettingSvc.defaultSettings)
            })
        }

        scope.close = function () {
          $location.url('/')
        }

        scope.handlerbarsDialog = function () {
          return clDialog.show({
            templateUrl: 'optional/settingsPage/handlebarsDialog.html',
            onComplete: function (scope, element) {
              var preElt = element[0].querySelector('.prism--editor')
              var cledit = $window.cledit(preElt)
              cledit.init({
                highlighter: function (text) {
                  return $window.Prism.highlight(text, $window.Prism.languages.javascript)
                }
              })
              cledit.setContent(clSettingSvc.values.handlebarsHelpers)
              scope.ok = function () {
                clSettingSvc.values.handlebarsHelpers = cledit.getContent()
                clDialog.hide()
              }
              scope.cancel = function () {
                clDialog.cancel()
              }
            }
          })
        }

        scope.editFileProperties = function () {
          clFilePropertiesDialog(clSettingSvc.values.defaultFileProperties)
            .then(function (properties) {
              clSettingSvc.values.defaultFileProperties = properties
            })
        }

        scope.signout = function () {
          $location.url('/')
          $timeout(clUserSvc.signout)
        }

        /* -----------------------
         * User
         */

        ;(function () {
          scope.deleteUser = function () {
            clDialog.show(clDialog.confirm()
              .title('Remove account')
              .content("You're about to sign out. Your data will be removed within 7 days. Just sign in again if you change your mind.")
              .ok('Ok')
              .cancel('Cancel'))
              .then(function () {
                clSocketSvc.sendMsg('deleteUser')
              })
          }

          scope.userName = function (name) {
            if (name) {
              clUserSvc.user.name = name
            }
            return clUserSvc.user.name
          }

          scope.userGravatarEmail = function (gravatarEmail) {
            if (arguments.length) {
              clUserSvc.user.gravatarEmail = gravatarEmail || undefined
            }
            return clUserSvc.user.gravatarEmail
          }

          var unwatchSocket = clStateMgr.state
            ? scope.$watch('socketSvc.isReady', function (isReady) {
              if (isReady) {
                unwatchSocket()
                if (clStateMgr.state) {
                  var newUserToken = clStateMgr.state.$search.newUserToken
                  if (clStateMgr.state.$search.userToken) {
                    clToast('Account is already in use.')
                  } else if (newUserToken) {
                    clSocketSvc.sendMsg('linkUser')
                  }
                }
              }
            })
            : undefined

          scope.apiKey = '••••••••••••••••••••••••••••••••'

          scope.renewApiKey = function () {
            clDialog.show(clDialog.confirm()
              .title('Renew API key')
              .content("You're about to renew your user API key. The old key won't work anymore and the new key will only be displayed once.")
              .ok('Ok')
              .cancel('Cancel'))
              .then(function () {
                if (!scope.renewApiKeyPending) {
                  scope.renewApiKeyPending = scope.$watch('socketSvc.isReady', function () {
                    clSocketSvc.sendMsg('renewUserApiKey')
                  })
                }
              })
          }

          function apiKeyHandler (msg) {
            if (scope.renewApiKeyPending) {
              scope.apiKey = msg.secret
              scope.renewApiKeyPending()
              scope.renewApiKeyPending = undefined
              scope.$evalAsync()
            }
          }

          clSocketSvc.addMsgHandler('userApiKey', apiKeyHandler)
          scope.$on('$destroy', function () {
            clSocketSvc.removeMsgHandler('userApiKey', apiKeyHandler)
          })
        })()

        /* -----------------------
         * Blogs
         */

        ;(function () {
          scope.editBlog = function (blog) {
            clDialog.show({
              templateUrl: 'optional/settingsPage/editBlogDialog.html',
              controller: ['$scope', function (scope) {
                scope.blog = blog
                scope.form = ({}).cl_extend(blog)
              }],
              onComplete: function (scope) {
                scope.ok = function () {
                  var newBlog = clBlogSvc.createBlog(scope.form)
                  if (newBlog) {
                    if (blog) {
                      newBlog.id = blog.id
                      clSocketSvc.sendMsg('updateBlog', {
                        blog: newBlog
                      })
                    } else {
                      clSocketSvc.sendMsg('createBlog', {
                        blog: newBlog
                      })
                    }
                    clDialog.hide()
                  }
                }
                scope.cancel = function () {
                  clDialog.cancel()
                }
              }
            })
              .then(function () {
                scope.getBlogsPending = true
              })
          }

          scope.deleteBlog = function (blog) {
            clDialog.show(clDialog.confirm()
              .title('Delete Blog')
              .content("You're about to remove a blog and its blog posts. Classeur files will be preserved and data already published on your website won't be affected.")
              .ok('Ok')
              .cancel('Cancel'))
              .then(function () {
                if (!scope.getBlogsPending) {
                  scope.getBlogsPending = scope.$watch('socketSvc.isReady', function () {
                    clSocketSvc.sendMsg('deleteBlog', {
                      id: blog.id
                    })
                  })
                }
              })
          }

          scope.getBlogs = function () {
            if (!scope.getBlogsPending) {
              scope.getBlogsPending = scope.$watch('socketSvc.isReady', function () {
                clSocketSvc.sendMsg('getBlogs')
              })
            }
          }

          function blogsHandler (msg) {
            if (scope.getBlogsPending) {
              scope.blogs = msg.blogs
              scope.anyDisabled = scope.blogs.cl_some(function (blog) {
                return blog.status === 'disabled'
              })
              scope.getBlogsPending()
              scope.getBlogsPending = undefined
              scope.$evalAsync()
            }
          }

          clSocketSvc.addMsgHandler('blogs', blogsHandler)
          scope.$on('$destroy', function () {
            clSocketSvc.removeMsgHandler('blogs', blogsHandler)
          })
        })()

        /* --------------------------
         * Trash
         */

        ;(function () {
          scope.getTrashFiles = function (reset) {
            if (reset) {
              scope.trashFiles = {}
              scope.trashRangeStart = 0
            }
            waitForSocketReady(function () {
              scope.trashRetrievePending = true
              clRestSvc.list('/api/v2/users/' + clSocketSvc.ctx.userId + '/files', {
                deleted: true,
                direction: 'desc'
              }, scope.trashRangeStart, scope.trashRangeStart + trashPageSize - 1)
                .then(function (items) {
                  scope.trashRetrievePending = false
                  scope.trashHasMore = items.length === trashPageSize
                  scope.trashRangeStart += items.length
                  items.cl_each(function (item) {
                    scope.trashFiles[item.id] = item
                    scope.trashEmpty = false
                  })
                  scope.$evalAsync()
                }, function (err) {
                  console.log(err.message, err.stack)
                })
            })
          }

          scope.recoverFile = function (item) {
            delete scope.trashFiles[item.id]
            clRestSvc.request({
              method: 'PUT',
              url: '/api/v2/files/' + item.id,
              body: {
                id: item.id,
                userId: item.userId,
                name: item.name,
                sharing: item.sharing,
                updated: item.updated
              }
            })
          }

          scope.removeFile = function (item) {
            clDialog.show(clDialog.confirm()
              .title('Remove from trash')
              .content('The file will be removed permanently. Are you sure?')
              .ok('Yes')
              .cancel('No'))
              .then(function () {
                delete scope.trashFiles[item.id]
                clRestSvc.request({
                  method: 'DELETE',
                  url: '/api/v2/files/' + item.id
                })
              })
          }
        })()

        scope.$watch('selectedTabIndex', function (newIndex) {
          var tab = tabs[newIndex]
          if (tab === 'trash') {
            scope.getTrashFiles(true)
          } else if (tab === 'blogs') {
            scope.getBlogs()
          }
          // If search location is empty, update it only if tab is not the default one
          if (newIndex || $location.search().tab) {
            $location.search('tab', tab)
          }
        })

        function applyLocationSearch () {
          scope.selectedTabIndex = tabs.indexOf($location.search().tab)
          scope.selectedTabIndex = scope.selectedTabIndex === -1 ? 0 : scope.selectedTabIndex
        }
        scope.$on('$locationChangeSuccess', applyLocationSearch)
        applyLocationSearch()
      }
    })
