export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: '调度平台外部API',
    version: '1.0.0',
    description: '定时任务执行、权限系统、告警系统、监控系统，对外API文档。此文档无需认证。实际接口除登录外均需在请求头传入 Authorization: Bearer <token>。',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: { success: { type: 'boolean' }, message: { type: 'string' } },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        summary: '登录获取令牌',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email', 'password'] },
            },
          },
        },
        responses: { '200': { description: '登录成功' }, '401': { description: '登录失败' } },
      },
    },
    '/auth/me': {
      get: { summary: '获取当前用户', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } },
    },
    '/tasks': {
      get: { summary: '任务列表', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } },
      post: { summary: '创建任务', security: [{ BearerAuth: [] }], responses: { '201': { description: '创建成功' } } },
    },
    '/tasks/{id}': {
      get: { summary: '获取任务', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: '成功' } } },
      put: { summary: '更新任务', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: '成功' } } },
      delete: { summary: '删除任务', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: '成功' } } },
    },
    '/tasks/{id}/trigger': {
      post: { summary: '手动触发任务', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: '成功' } } },
    },
    '/monitoring/dashboard/stats': { get: { summary: '仪表盘统计', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } } },
    '/monitoring/executions/trends': { get: { summary: '执行趋势', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } } },
    '/monitoring/system/health': { get: { summary: '系统健康', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } } },
    '/iam/resources': {
      get: { summary: '资源列表', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } },
      post: { summary: '创建资源', security: [{ BearerAuth: [] }], responses: { '201': { description: '创建成功' } } },
    },
    '/iam/roles': {
      get: { summary: '角色列表', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } },
      post: { summary: '创建角色', security: [{ BearerAuth: [] }], responses: { '201': { description: '创建成功' } } },
    },
    '/iam/users/{id}/roles': {
      get: { summary: '用户角色列表', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: '成功' } } },
      post: { summary: '绑定用户角色', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: '成功' } } },
    },
    '/notifications/rules': {
      get: { summary: '告警规则列表', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } },
      post: { summary: '创建告警规则', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } },
    },
    '/systems': {
      get: { summary: '业务系统列表', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } },
      post: { summary: '创建业务系统', security: [{ BearerAuth: [] }], responses: { '200': { description: '成功' } } },
    },
  },
}

