angular.module('classeur.core.user', [])
    .factory('clUserSvc', function($rootScope, $location, clLocalStorageObject, clSocketSvc) {
        var clUserSvc = clLocalStorageObject('userSvc');

        function signin(token) {
            clSocketSvc.setToken(token);
            clSocketSvc.openSocket();
        }

        function signout() {
            clSocketSvc.clearToken();
            clSocketSvc.closeSocket();
            clUserSvc.user = null;
        }

        clUserSvc.read = function() {
            this.$readAttr('user', null, JSON.parse);
            this.$readLocalUpdate();
        };

        clUserSvc.write = function(updated) {
            this.$writeAttr('user', JSON.stringify, updated);
        };

        function checkAll() {
            if (clUserSvc.$checkGlobalUpdate()) {
                clUserSvc.read();
                return true;
            } else {
                clUserSvc.write();
            }
        }

        clUserSvc.read();

        clSocketSvc.addMsgHandler('invalidToken', function() {
            signout();
            $rootScope.$evalAsync();
        });

        clUserSvc.signin = signin;
        clUserSvc.signout = signout;
        clUserSvc.checkAll = checkAll;

        return clUserSvc;
    })
    .factory('clUserInfoSvc', function($rootScope, clSocketSvc, clSetInterval, clUserSvc) {
        var requestedUserInfo = {};
        var userInfoTimeout = 30000;
        var lastUserInfoAttempt = 0;

        clSetInterval(function() {
            var currentDate = Date.now();
            var userIds = Object.keys(requestedUserInfo);
            if (userIds.length && currentDate - lastUserInfoAttempt > userInfoTimeout) {
                lastUserInfoAttempt = currentDate;
                clSocketSvc.sendMsg({
                    type: 'getUserInfo',
                    ids: userIds,
                });
            }
        }, 1100, true);

        clSocketSvc.addMsgHandler('userInfo', function(msg) {
            msg.users.forEach(function(user) {
                clUserInfoSvc.users[user.id] = user;
                delete requestedUserInfo[user.id];
            });
            clUserInfoSvc.lastUserInfo = Date.now();
            lastUserInfoAttempt = 0;
            $rootScope.$evalAsync();
        });

        $rootScope.$watch('userSvc.user', function(user) {
            if (user) {
                clUserInfoSvc.users[user.id] = {
                    id: user.id,
                    name: user.name
                };
                clUserInfoSvc.lastUserInfo = Date.now();
            }
        });

        var clUserInfoSvc = {
            users: {},
            request: function(id) {
                if (!clUserInfoSvc.hasOwnProperty(id)) {
                    if (!clUserSvc.user || clUserSvc.user.id !== id) {
                        requestedUserInfo[id] = true;
                    }
                }
            }
        };

        return clUserInfoSvc;
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
                    $http.post('/api/users/new', {
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
