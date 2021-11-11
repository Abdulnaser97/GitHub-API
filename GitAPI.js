// The github-api is the dedicated package to traverse the Github API.
const GitHub = require("github-api");

// Fetch the data from the API and stores them in 'data' object
async function getGitHubData(token) {
  let gh = new GitHub({
    token: token,
  });

  let data = {};

  // getUser() fetches the user details from the API such as notifications, repositories, and so on.
  let me = gh.getUser();
  let repos = await me.listRepos();
  data.repos = repos.data;
  return data;
}

module.exports = getGitHubData;
