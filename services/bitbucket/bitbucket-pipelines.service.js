import Joi from 'joi'
import { renderBuildStatusBadge } from '../build-status.js'
import { BaseJsonService, redirector, pathParams } from '../index.js'

const bitbucketPipelinesSchema = Joi.object({
  values: Joi.array()
    .items(
      Joi.object({
        state: Joi.object({
          name: Joi.string().required(),
          result: Joi.object({
            name: Joi.equal(
              'SUCCESSFUL',
              'FAILED',
              'ERROR',
              'STOPPED',
              'EXPIRED',
            ),
          }).required(),
        }).required(),
      }),
    )
    .required(),
}).required()

class BitbucketPipelines extends BaseJsonService {
  static category = 'build'
  static route = {
    base: 'bitbucket/pipelines',
    pattern: ':user/:repo/:branch+',
  }

  static openApi = {
    '/bitbucket/pipelines/{user}/{repo}/{branch}': {
      get: {
        summary: 'Bitbucket Pipelines',
        parameters: pathParams(
          {
            name: 'user',
            example: 'atlassian',
          },
          {
            name: 'repo',
            example: 'adf-builder-javascript',
          },
          {
            name: 'branch',
            example: 'task/SECO-2168',
          },
        ),
      },
    },
  }

  static defaultBadgeData = { label: 'build' }

  static render({ status }) {
    return renderBuildStatusBadge({ status: status.toLowerCase() })
  }

  async fetch({ user, repo, branch }) {
    const url = `https://api.bitbucket.org/2.0/repositories/${user}/${repo}/pipelines/`
    return this._requestJson({
      url,
      schema: bitbucketPipelinesSchema,
      options: {
        searchParams: {
          fields: 'values.state',
          page: 1,
          pagelen: 2,
          sort: '-created_on',
          'target.ref_type': 'BRANCH',
          'target.ref_name': branch,
        },
      },
      httpErrors: { 403: 'private repo' },
    })
  }

  static transform(data) {
    const values = data.values.filter(
      value => value.state && value.state.name === 'COMPLETED',
    )
    if (values.length > 0) {
      return values[0].state.result.name
    }
    return 'never built'
  }

  async handle({ user, repo, branch }) {
    const data = await this.fetch({ user, repo, branch })
    return this.constructor.render({ status: this.constructor.transform(data) })
  }
}

const BitbucketPipelinesRedirector = redirector({
  category: 'build',
  route: {
    base: 'bitbucket/pipelines',
    pattern: ':user/:repo',
  },
  transformPath: ({ user, repo }) =>
    `/bitbucket/pipelines/${user}/${repo}/master`,
  dateAdded: new Date('2020-07-12'),
})

export { BitbucketPipelines, BitbucketPipelinesRedirector }
