(function (root) {
    'use strict';

    function getUserName() {
        const userElement = document.querySelector('.avatar-wrapper.el-dropdown-selfdefine');
        return userElement ? userElement.textContent.trim() : '小伙伴';
    }

    function getAdminToken() {
        const cookies = document.cookie.split('; ');
        for (const cookie of cookies) {
            const separator = cookie.indexOf('=');
            const name = separator < 0 ? cookie : cookie.slice(0, separator);
            if (name === 'Admin-Token') return separator < 0 ? '' : cookie.slice(separator + 1);
        }
        return null;
    }

    function getUserInfo() {
        const token = getAdminToken() || '';
        return { name: getUserName(), token, tokenValid: token.length >= 10 };
    }

    root.ReviewPlusModules = root.ReviewPlusModules || {};
    root.ReviewPlusModules.userContext = { getUserName, getAdminToken, getUserInfo };
})(globalThis);
