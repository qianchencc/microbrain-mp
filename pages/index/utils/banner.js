import { fetchBanner } from "@/apis/home"
import { fecthFilePage } from '@/apis/common'
import { ref, watch, computed } from 'vue'
import { DOMAIN } from '@/config/settings'
import { useUserStoreHook } from '@/store/modules/user'
const geospatial = computed(() => useUserStoreHook().getDistrict.name)
const authorized = computed(() => useUserStoreHook().authorized)
export const useBannerHook = () => {
	const bannerList = ref([{ url: '/static/images/index/map.png' }, { pic: '/static/images/index/banner01.jpg' }])
	const getBannerList = async () => {
		const res = await fetchBanner()
		if (!res || !res.content) return
		getFile(res.content.id)
	}

	async function getFile(id) {
		if (!id) return
		const data = {
			businessId: id
		}
		const res = await fecthFilePage(data)
		if (!res) return
		bannerList.value = res.content.content.map(val => {
			return {
				url: DOMAIN + '/file/' + val.uri
			}
		})
	}

	watch([geospatial.value, authorized.value], () => {
		getBannerList()
	})

	if (authorized.value) {
		getBannerList()
	}

	return {
		bannerList
	}
}