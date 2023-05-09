import { KUBEWARDEN_PRODUCT_NAME } from '../types';

import Dashboard from '../pages/c/_cluster/kubewarden/index.vue';
import KubewardenResourcedList from '../pages/c/_cluster/kubewarden/_resource/index.vue';
import CreateKubewardenResource from '../pages/c/_cluster/kubewarden/_resource/create.vue';
import ViewKubewardenResource from '../pages/c/_cluster/kubewarden/_resource/_id.vue';
import ViewKubewardenNsResource from '../pages/c/_cluster/kubewarden/_resource/_namespace/_id.vue';

const routes = [
  {
    name:       `c-cluster-${ KUBEWARDEN_PRODUCT_NAME }`,
    path:       `/c/:cluster/:product/dashboard`,
    component:  Dashboard,
    meta:      {
      product: KUBEWARDEN_PRODUCT_NAME,
      pkg:     KUBEWARDEN_PRODUCT_NAME
    }
  },
  {
    name:       `c-cluster-${ KUBEWARDEN_PRODUCT_NAME }-resource`,
    path:       `/c/:cluster/:product/:resource`,
    component:  KubewardenResourcedList,
    meta:      {
      product: KUBEWARDEN_PRODUCT_NAME,
      pkg:     KUBEWARDEN_PRODUCT_NAME
    }
  },
  {
    name:       `c-cluster-${ KUBEWARDEN_PRODUCT_NAME }-resource-create`,
    path:       `/c/:cluster/:product/:resource/create`,
    component:  CreateKubewardenResource,
    meta:      {
      product: KUBEWARDEN_PRODUCT_NAME,
      pkg:     KUBEWARDEN_PRODUCT_NAME
    }
  },
  {
    name:       `c-cluster-${ KUBEWARDEN_PRODUCT_NAME }-resource-id`,
    path:       `/c/:cluster/:product/:resource/:id`,
    component:  ViewKubewardenResource,
    meta:      {
      product: KUBEWARDEN_PRODUCT_NAME,
      pkg:     KUBEWARDEN_PRODUCT_NAME
    }
  },
  {
    name:       `c-cluster-${ KUBEWARDEN_PRODUCT_NAME }-resource-namespace-id`,
    path:       `/c/:cluster/:product/:resource/:namespace/:id`,
    component:  ViewKubewardenNsResource,
    meta:      {
      product: KUBEWARDEN_PRODUCT_NAME,
      pkg:     KUBEWARDEN_PRODUCT_NAME
    }
  }
];

export default routes;
