angular.module('classeur.blogs.zendesk', [])
  .directive('clZendeskBlogForm',
    function () {
      return {
        restrict: 'E',
        templateUrl: 'blogs/zendesk/zendeskBlogForm.html'
      }
    })
  .directive('clZendeskBlogPostEntry',
    function () {
      return {
        restrict: 'E',
        templateUrl: 'blogs/zendesk/zendeskBlogPostEntry.html'
      }
    })
  .directive('clZendeskBlogPostForm',
    function () {
      return {
        restrict: 'E',
        templateUrl: 'blogs/zendesk/zendeskBlogPostForm.html'
      }
    })
  .factory('clZendeskBlogPlatform',
    function (clBlogPlatform, clConfig, clUrlSanitizer) {
      var clZendeskBlogPlatform = clBlogPlatform({
        id: 'zendesk',
        name: 'Zendesk',
        enabled: !!clConfig.zendeskClientId,
        authorizeUrl: 'https://' + clConfig.zendeskSubdomain + '.zendesk.com/oauth/authorizations/new'
      })

      clZendeskBlogPlatform.createBlogFromSubForm = function (subForm) {
        if (isNaN(parseInt(subForm.sectionId, 10))) {
          throw new Error('Section ID is invalid.')
        }
        return {
          sectionId: subForm.sectionId
        }
      }

      clZendeskBlogPlatform.createPostFromSubForm = function (subForm) {
        if (subForm.articleId && isNaN(parseInt(subForm.articleId, 10))) {
          throw new Error('Article ID is invalid.')
        }
        return {
          articleId: subForm.articleId,
          locale: subForm.locale || 'en-us'
        }
      }

      clZendeskBlogPlatform.getAuthorizeParams = function (blog) {
        return {
          client_id: clConfig.zendeskClientId,
          response_type: 'code',
          redirect_uri: clConfig.appUri + '/oauth/zendesk/callback',
          scope: 'hc:read hc:write'
        }
      }

      clZendeskBlogPlatform.getBlogPostLocation = function (blogPost) {
        return 'https://' + clConfig.zendeskSubdomain + '.zendesk.com/hc/' + blogPost.locale + '/articles/' + blogPost.articleId
      }

      return clZendeskBlogPlatform
    })
