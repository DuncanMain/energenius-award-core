import { ApiResponse } from './apiResponse';
import { BaseApi } from './baseApi';
import { authFetch } from './fetchClient';
import { Award } from '@/models/award';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '/v1').replace(
  /\/+$/,''
);

class AwardApi extends BaseApi {
  async getAwards(): Promise<ApiResponse<Award[]>> {
    return this.handleRequest(() => authFetch(`${API_BASE_URL}/award`));
  }

  async claimAward(uid: string, eventId: string): Promise<ApiResponse<any>> {
    return this.handleRequest(() =>
      authFetch(`${API_BASE_URL}/award/event`, {
        method: 'POST',
        body: JSON.stringify({ uid, eventId }),
      })
    );
  }
}

export const awardApi = new AwardApi();
