angular.module('classeur.extensions.footer', [])
    .directive('clFooter', function(clUserSvc) {
        return {
            restrict: 'E',
            templateUrl: 'extensions/footer/footer.html',
            link: function(scope) {
                scope.signout = function() {
                    clUserSvc.signout();
                };
            }
        };
    });
