const { prompt, MultiSelect } = require('enquirer');
const axios = require('axios');

async function run() {
  const registryParams = await prompt([
    {
      type: 'input',
      name: 'address',
      message: 'What is the URL for the registry? (e.g. https://localhost:5000)',
    },
    {
      type: 'input',
      name: 'username',
      message: 'What is the username?',
    },
    {
      type: 'password',
      name: 'password',
      message: 'What is the password?',
    },
  ]);

  const auth = {
    username: registryParams.username,
    password: registryParams.password,
  };

  const { data: { repositories } } = await axios.get(`${registryParams.address}/v2/_catalog`, {
    auth,
  });

  const images = (await Promise.all(repositories.map(async (repo) => {
    const { data: { tags } } = await axios.get(`${registryParams.address}/v2/${repo}/tags/list`, {
      auth,
    });
    return tags.map((tag) => ({ name: `${repo}: ${tag}`, value: { repo, tag } }));
  }))).flat();

  const imageSelect = new MultiSelect({
    message: 'Select images to remove',
    choices: images,
    result(images) {
      return this.map(images);
    },
  });

  const choices = Object.values(await imageSelect.run());

  await Promise.all(choices.map(async ({ repo, tag }) => {
    const { headers } = await axios.get(`${registryParams.address}/v2/${repo}/manifests/${tag}`, {
      auth,
      headers: {
        Accept: 'application/vnd.docker.distribution.manifest.v2+json',
      },
    });
    const digest = headers['docker-content-digest'];
    await axios.delete(`${registryParams.address}/v2/${repo}/manifests/${digest}`, {
      auth,
    });
  }));
}

run();