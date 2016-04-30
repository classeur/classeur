angular.module('classeur.core.sync.contentSync', [])
  .factory('clContentSyncSvc',
    function ($rootScope, $timeout, $q, clRestSvc, clSetInterval, clSocketSvc, clUserSvc, clUserActivity, clSyncDataSvc, clFileSvc, clToast, clDiffUtils, clEditorSvc, clEditorContentSvc, clUserInfoSvc, clUid, clIsNavigatorOnline, clIsSyncWindow, clEditorLayoutSvc) {
      var loadingTimeout = 30 * 1000 // 30 sec
      var textMaxSize = 200000
      var backgroundUpdateContentEvery = 30 * 1000 // 30 sec
      var clContentSyncSvc = {}
      var watchCtx

      function setWatchCtx (ctx) {
        watchCtx = ctx
        clContentSyncSvc.watchCtx = ctx
      }
      clSocketSvc.addMsgHandler('userToken', setWatchCtx.cl_bind(null, null))

      function setLoadedContent (file, serverContent) {
        file.setLoaded()
        file.content.text = serverContent.text
        file.content.properties = ({}).cl_extend(serverContent.properties)
        file.content.discussions = ({}).cl_extend(serverContent.discussions)
        file.content.comments = ({}).cl_extend(serverContent.comments)
        file.content.state = {}
        // addToDaos calls init
        if (!file.addToDaos) {
          clFileSvc.init() // Will delete the content if called while file is not in the daos
        }
      }

      function setLoadingError (file, error) {
        if (file.state === 'loading') {
          file.state = undefined
        }
        error
          ? clToast(error)
          : clToast.notAccessible(file)
      }

      function applyServerContent (file, oldContent, serverContent) {
        var newContent = clDiffUtils.mergeFlattenContent(oldContent, file.content, serverContent)
        file.content.text = newContent.text
        file.content.properties = newContent.properties
        file.content.discussions = newContent.discussions
        file.content.comments = newContent.comments
        clEditorContentSvc.applyContent(true)
      }

      function watchContent (file) {
        if (watchCtx) {
          if (file === watchCtx.file) {
            // File already being watched
            return
          } else {
            // Stop previous file watching
            clSocketSvc.sendMsg('stopWatchContent', {
              id: watchCtx.id
            })
            setWatchCtx()
          }
        }
        if (!file || !file.state || file.isLocalFile || !clSyncDataSvc.files[file.id]) {
          return
        }
        file.loadPending = false
        setWatchCtx({
          id: clUid(),
          file: file,
          userCursors: {},
          contentChanges: []
        })
        clSocketSvc.sendMsg('startWatchContent', {
          id: watchCtx.id,
          fileId: file.id,
          previousRev: file.content && file.content.syncedRev
        })
        $timeout.cancel(file.loadingTimeoutId)
        file.loadingTimeoutId = $timeout(function () {
          setLoadingError(file, 'Loading timeout.')
        }, loadingTimeout)
      }

      clSocketSvc.addMsgHandler('watchedContent', function (msg) {
        if (!watchCtx || !watchCtx.file.state || watchCtx.id !== msg.id) {
          return
        }
        var file = watchCtx.file
        $timeout.cancel(file.loadingTimeoutId)
        if (msg.error) {
          return setLoadingError(file)
        }
        var oldContent = clDiffUtils.flattenContent(msg.previousContent || msg.lastContent)
        var serverContent = clDiffUtils.flattenContent(msg.lastContent)
        if (file.state === 'loading') {
          setLoadedContent(file, serverContent)
        } else {
          applyServerContent(file, oldContent, serverContent)
        }
        watchCtx.text = serverContent.text
        watchCtx.properties = serverContent.properties
        watchCtx.discussions = serverContent.discussions
        watchCtx.comments = serverContent.comments
        watchCtx.rev = serverContent.rev
        // Evaluate scope synchronously to have cledit instantiated
        $rootScope.$apply()
        // Changes can be received before the watchedFile
        applyContentChanges()
      })

      function getPublicContent (file) {
        if (!file || !file.state || !file.loadPending || !file.userId || !clIsNavigatorOnline()) {
          return
        }
        var lastContent
        var syncedContent
        file.loadPending = false
        clRestSvc.request({
          method: 'GET',
          url: '/api/v2/files/' + file.id + '/contentRevs/last'
        })
          .then(function (res) {
            lastContent = res.body
            if (file.content && file.content.syncedRev < lastContent.rev) {
              return clRestSvc.request({
                method: 'GET',
                url: '/api/v2/files/' + file.id + '/contentRevs/' + file.content.syncedRev
              })
                .then(function (res) {
                  syncedContent = res.body
                })
            }
          })
          .then(function () {
            if (!file.content) {
              setLoadedContent(file, lastContent)
            } else {
              applyServerContent(file, syncedContent || lastContent, lastContent)
            }
            file.setContentSynced(lastContent.rev)
            // Evaluate scope synchronously to have cledit instantiated
            $rootScope.$apply()
          })
          .catch(function () {
            setLoadingError(file)
          })
      }

      var lastTooBigWarning = 0

      function tooBigWarning () {
        var currentDate = Date.now()
        if (currentDate - lastTooBigWarning > 30000) {
          clToast('File is too big!')
          lastTooBigWarning = currentDate
        }
      }

      function sendContentChange () {
        if (!watchCtx || watchCtx.rev === undefined || watchCtx.sentMsg) {
          return
        }
        if (watchCtx.file.userId && watchCtx.file.sharing !== 'rw') {
          return
        }
        if (watchCtx.file.content.text.length > textMaxSize) {
          return tooBigWarning()
        }
        var msg = clDiffUtils.makeContentChange(watchCtx, watchCtx.file.content)
        if (msg) {
          msg.id = watchCtx.id
          msg.rev = watchCtx.rev + 1
          watchCtx.sentMsg = msg
          clSocketSvc.sendMsg('setContentChange', msg)
        }
      }

      function applyContentChanges () {
        if (watchCtx.rev === undefined) {
          return
        }
        var contentChange
        var apply
        while ((contentChange = watchCtx.contentChanges[watchCtx.rev + 1])) {
          watchCtx.rev = contentChange.rev
          if (!contentChange.userId && watchCtx.sentMsg && contentChange.rev === watchCtx.sentMsg.rev) {
            // Has to be the previously sent message
            contentChange = watchCtx.sentMsg
            watchCtx.contentChanges[contentChange.rev] = watchCtx.sentMsg
          }
          var newServerContent = clDiffUtils.applyContentChanges(watchCtx, [contentChange], false)
          apply |= !!(contentChange.properties || contentChange.discussions || contentChange.comments)
          if (contentChange !== watchCtx.sentMsg) {
            var serverTextChanged = watchCtx.text !== newServerContent.text
            var textSynchronized = newServerContent.text === watchCtx.file.content.text
            if (!textSynchronized && serverTextChanged) {
              watchCtx.file.content.text = clDiffUtils.quickPatch(
                watchCtx.text,
                newServerContent.text,
                watchCtx.file.content.text
              )
              watchCtx.file.content.properties = clDiffUtils.mergeObjects(
                watchCtx.properties,
                watchCtx.file.content.properties,
                newServerContent.properties
              )
              watchCtx.file.content.discussions = clDiffUtils.mergeObjects(
                watchCtx.discussions,
                watchCtx.file.content.discussions,
                newServerContent.discussions
              )
              watchCtx.file.content.comments = clDiffUtils.mergeObjects(
                watchCtx.comments,
                watchCtx.file.content.comments,
                newServerContent.comments
              )
              var offset = clEditorContentSvc.applyContent(true)
              var userCursor = watchCtx.userCursors[contentChange.userId] || {}
              userCursor.offset = offset
              watchCtx.userCursors[contentChange.userId] = userCursor
            }
            clUserInfoSvc.request(contentChange.userId)
          }
          watchCtx.sentMsg = undefined
          watchCtx.text = newServerContent.text
          watchCtx.properties = newServerContent.properties
          watchCtx.discussions = newServerContent.discussions
          watchCtx.comments = newServerContent.comments
        }
        watchCtx.file.setContentSynced(watchCtx.rev)
        apply && $rootScope.$evalAsync()
      }

      clSocketSvc.addMsgHandler('contentChange', function (msg) {
        if (!watchCtx || watchCtx.id !== msg.id || watchCtx.rev >= msg.rev) {
          return
        }
        watchCtx.contentChanges[msg.rev] = msg
        applyContentChanges()
      })

      clContentSyncSvc.retrieveRevision = function (rev) {
        if (!watchCtx) {
          return
        }
        var toRev = watchCtx.rev
        while (watchCtx.contentChanges[toRev] && toRev > rev) {
          toRev--
        }
        var fileId = watchCtx.file.id
        return Promise.resolve()
          .then(function () {
            if (toRev !== rev) {
              return clRestSvc.list('/api/v2/files/' + fileId + '/contentChanges', null, rev, toRev - 1)
                .then(function (items) {
                  if (watchCtx && watchCtx.file.id === fileId) {
                    items.cl_each(function (item) {
                      watchCtx.contentChanges[item.rev] = item
                    })
                  }
                })
            }
          })
          .then(function () {
            var contentChanges = watchCtx.contentChanges.slice(rev + 1, watchCtx.rev + 1).reverse()
            return clDiffUtils.applyContentChanges(watchCtx, contentChanges, true)
          })
      }

      clSetInterval(function () {
        if (!clSocketSvc.isReady || !clIsSyncWindow()) {
          return
        }

        // Send modified local files
        clFileSvc.readLocalFileChanges()
        clFileSvc.localFiles.cl_each(function (file) {
          if (
            (!file.userId || file.sharing === 'rw') && // is writable
            clSyncDataSvc.files[file.id] && // exists on the server
            (!watchCtx || file !== watchCtx.file) && // is not being edited in the current tab
            Date.now() - file.content.lastChange > backgroundUpdateContentEvery // is not being edited in another tab
          ) {
            try {
              file.loadDoUnload(function () {
                if (!file.isContentSynced()) {
                  clRestSvc.request({
                    method: 'PATCH',
                    url: '/api/v2/files/' + file.id + '/contentRevs/' + (file.content.syncedRev === undefined ? 'last' : file.content.syncedRev),
                    body: {
                      text: file.content.text,
                      properties: file.content.properties,
                      discussions: file.content.discussions,
                      comments: file.content.comments
                    }
                  })
                    .then(function (res) {
                      clFileSvc.readLocalFileChanges()
                      if (
                        file.content && // still local
                        (!watchCtx || file.id !== watchCtx.file.id) && // is not being edited in the current tab
                        Date.now() - file.content.lastChange > backgroundUpdateContentEvery // is not being edited in another tab
                      ) {
                        try {
                          file.loadDoUnload(function () {
                            file.content.text = res.body.text
                            file.content.properties = res.body.properties
                            file.content.discussions = res.body.discussions
                            file.content.comments = res.body.comments
                            file.setContentSynced(res.body.rev)
                            file.writeContent()
                          })
                          clFileSvc.writeLocalFileChanges()
                        } catch (e) {
                          // File is not local
                        }
                      }
                    })
                }
              })
            } catch (e) {
              // File is not local
            }
          }
        })
      }, backgroundUpdateContentEvery)

      $rootScope.$watch('currentFile', function (currentFile) {
        if (currentFile) {
          currentFile.loadPending = true
        }
        if (clSocketSvc.isReady) {
          watchContent(currentFile)
        } else if (!clSocketSvc.hasToken) {
          getPublicContent(currentFile)
        }
      })

      clSetInterval(function () {
        if (!clUserActivity.checkActivity()) {
          return
        }
        clFileSvc.readLocalFileChanges()
        if ($rootScope.currentFile && $rootScope.currentFile.state === 'loaded') {
          $rootScope.currentFile.writeContent()
        }
        clFileSvc.writeLocalFileChanges()
        if (clSocketSvc.isReady) {
          watchContent($rootScope.currentFile)
          sendContentChange()
        } else if (!clSocketSvc.hasToken) {
          getPublicContent($rootScope.currentFile)
        }
      }, 200)

      return clContentSyncSvc
    })
