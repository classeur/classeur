angular.module('classeur.core.user', [])
    .factory('clUserSvc', function($rootScope, $location, clSettingSvc, clSocketSvc, clSetInterval) {
        clSettingSvc.setDefaultValue('defaultUserName', 'Anonymous');

        function signin(token) {
            clSocketSvc.setToken(token);
            clSocketSvc.openSocket();
        }

        function signout() {
            clUserSvc.user = undefined;
            clSocketSvc.clearToken();
            clSocketSvc.closeSocket();
        }

        clSocketSvc.addMsgHandler('signedInUser', function(msg) {
            clUserSvc.user = msg.user;
            userInfo[msg.user.id] = {
                id: msg.user.id,
                name: msg.user.name
            };
            clUserSvc.lastUserInfo = Date.now();
            $rootScope.$apply();
        });

        clSocketSvc.addMsgHandler('invalidToken', function() {
            signout();
            $rootScope.$apply();
        });

        var userInfo = {};
        var requestedUserInfo = {};
        var maxUserInfoInactivity = 30000;
        var lastUserInfoActivity = 0;

        clSetInterval(function() {
            var currentDate = Date.now();
            var userIds = Object.keys(requestedUserInfo);
            if (userIds.length && currentDate - lastUserInfoActivity > maxUserInfoInactivity) {
                lastUserInfoActivity = currentDate;
                clSocketSvc.sendMsg({
                    type: 'getUserInfo',
                    ids: userIds,
                });
            }
        }, 1000, true);

        clSocketSvc.addMsgHandler('userInfo', function(msg) {
            msg.users.forEach(function(user) {
                userInfo[user.id] = user;
                delete requestedUserInfo[user.id];
            });
            clUserSvc.lastUserInfo = lastUserInfoActivity = Date.now();
            $rootScope.$apply();
        });

        var clUserSvc = {
            isReady: false,
            signin: signin,
            signout: signout,
            userInfo: userInfo,
            requestUserInfo: function(id) {
                if(!userInfo.hasOwnProperty(id)) {
                    requestedUserInfo[id] = true;
                }
            }
        };

        return clUserSvc;
    })
    .directive('clNewUserForm', function($location, $http, clToast, clUserSvc, clStateMgr) {
        return {
            restrict: 'E',
            templateUrl: 'core/user/newUserForm.html',
            link: function(scope) {
                scope.close = function() {
                    $location.url('');
                };

                scope.create = function() {
                    if (!scope.newUser.name) {
                        return;
                    }
                    scope.isLoading = true;
                    $http.post('/ajax/user/new', {
                            name: scope.newUser.name,
                            syncFilesAndSettings: scope.newUser.syncFilesAndSettings,
                            token: clStateMgr.token
                        })
                        .success(function(userToken) {
                            clUserSvc.signin(userToken);
                            $location.url('');
                        })
                        .error(function(data, status) {
                            clToast(data.reason || 'Error: ' + status);
                        });
                };

                if (!clStateMgr.token) {
                    return scope.close();
                }

                // Decode JWT
                var data = clStateMgr.token && clStateMgr.token.split('.');
                try {
                    scope.newUser = JSON.parse(atob(data[1]));
                } catch (e) {
                    return scope.close();
                }

                if (scope.newUser.type === 'user') {
                    clUserSvc.signin(clStateMgr.token);
                    return scope.close();
                }

                scope.newUser.syncFilesAndSettings = true;
            }
        };
    });
