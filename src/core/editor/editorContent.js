angular.module('classeur.core.editor.editorContent', [])
  .factory('clEditorContentSvc',
    function ($window, clUid, clDiffUtils) {
      var clEditorContentSvc = {
        createCledit: createCledit,
        initCledit: initCledit,
        applyContent: applyContent,
        syncDiscussionMarkers: syncDiscussionMarkers,
        newDiscussion: {},
        newDiscussionId: clUid()
      }

      var cledit
      var markerKeys
      var markerIdxMap
      var previousPatchableText
      var currentPatchableText
      var discussionMarkers
      function createCledit (elt, scrollerElt) {
        cledit = $window.cledit(elt, scrollerElt)
        markerKeys = []
        markerIdxMap = Object.create(null)
        previousPatchableText = ''
        currentPatchableText = ''
        discussionMarkers = {}
        cledit.on('contentChanged', onContentChanged)
        return cledit
      }

      var content
      function initCledit (newContent, options, reinit) {
        if (newContent) {
          options = angular.extend({}, options)

          if (content !== newContent) {
            content = newContent
            syncDiscussionMarkers()
          }

          if (!reinit) {
            options.content = content.text
            ;['selectionStart', 'selectionEnd', 'scrollTop'].cl_each(function (key) {
              options[key] = content.state[key]
            })
          }

          options.patchHandler = {
            makePatches: makePatches,
            applyPatches: applyPatches,
            reversePatches: reversePatches
          }
          cledit.init(options)
        }
      }

      var isChangePatch
      function onContentChanged (text) {
        content.text = text
        if (!isChangePatch) {
          syncDiscussionMarkers()
          previousPatchableText = currentPatchableText
          currentPatchableText = clDiffUtils.makePatchableText(content, markerKeys, markerIdxMap)
        } else {
          syncDiscussionMarkers(true)
        }
        isChangePatch = false
        clEditorContentSvc.lastChange = Date.now()
      }

      function syncDiscussionMarkers (isPatch) {
        discussionMarkers.cl_each(function (marker, markerKey) {
          if (marker.discussionId !== clEditorContentSvc.newDiscussionId) {
            // Remove marker if discussion was removed
            var discussion = content.discussions[marker.discussionId]
            if (!discussion || !discussion[marker.offsetName]) {
              cledit.removeMarker(marker)
              delete discussionMarkers[markerKey]
            }
          }
        })

        function checkDiscussion (discussion, discussionId) {
          function checkMarker (offsetName) {
            var markerOffset = discussion[offsetName]
            var markerKey = discussionId + offsetName
            var marker = discussionMarkers[markerKey]
            var idx = markerIdxMap[markerKey]
            var textMarkerOffset = -1
            if (isPatch && idx !== undefined) {
              var textMarker = String.fromCharCode(0xe000 + marker.idx)
              textMarkerOffset = currentPatchableText.indexOf(textMarker)
            }
            if (markerOffset !== undefined || ~textMarkerOffset) {
              if (!marker) {
                marker = new $window.cledit.Marker(markerOffset)
                marker.discussionId = discussionId
                marker.offsetName = offsetName
                cledit.addMarker(marker)
                discussionMarkers[markerKey] = marker
              }
              if (~textMarkerOffset) {
                marker.offset = textMarkerOffset
              }
              discussion[offsetName] = marker.offset
            }
          }
          checkMarker('offset0')
          checkMarker('offset1')
        }

        content.discussions.cl_each(checkDiscussion)
        checkDiscussion(clEditorContentSvc.newDiscussion, clEditorContentSvc.newDiscussionId)
      }

      function applyContent (isExternal) {
        if (cledit) {
          if (isExternal) {
            clEditorContentSvc.lastExternalChange = Date.now()
          }
          syncDiscussionMarkers()
          return cledit.setContent(content.text, isExternal)
        }
      }

      /* eslint-disable new-cap */
      var diffMatchPatch = new window.diff_match_patch()
      /* eslint-enable new-cap */

      function makePatches () {
        var diffs = diffMatchPatch.diff_main(previousPatchableText, currentPatchableText)
        return diffMatchPatch.patch_make(previousPatchableText, diffs)
      }

      function applyPatches (patches) {
        var newPatchableText = diffMatchPatch.patch_apply(patches, currentPatchableText)[0]
        var result = newPatchableText
        if (markerKeys.length) {
          // Strip text markers
          result = result.replace(new RegExp('[\ue000-' + String.fromCharCode(0xe000 + markerKeys.length - 1) + ']', 'g'), '')
        }
        // Expect a `contentChanged` event
        if (result !== cledit.getContent()) {
          previousPatchableText = currentPatchableText
          currentPatchableText = newPatchableText
          isChangePatch = true
        }
        return result
      }

      function reversePatches (patches) {
        patches = diffMatchPatch.patch_deepCopy(patches).reverse()
        patches.cl_each(function (patch) {
          patch.diffs.cl_each(function (diff) {
            diff[0] = -diff[0]
          })
        })
        return patches
      }

      return clEditorContentSvc
    })
