import { fetchBanner } from "@/apis/home"
import { ref } from 'vue'
export const useBannerHook = () => {
	const bannerList = ref()
	const getBannerList = async () => {
		const res = await fetchBanner()
		bannerList.value = res.content
	}
	getBannerList()

	return {
		bannerList
	}
}