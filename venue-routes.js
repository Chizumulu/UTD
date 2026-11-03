// 자동 생성 파일 — scripts/fetch-venue-routes.js 로 만든 값입니다. 직접 고치지 마세요.
// 생성일: 2026-11-03 · 출처: OSRM(OpenStreetMap 도로 데이터) 최단시간 경로(간선도로 우선)
// roadKm/roadMin: 은카타베이 항구 → 구장 도로 거리(km)/OSRM 소요시간(분), snapM: 구장 좌표에서 가장 가까운 도로까지 거리(m)
// line: 도로 경로선(polyline 압축 문자열, 지도 표시용) · realMin: 현지 확인 육로 소요시간(분, 직접 입력값 — 재생성해도 유지됨)
const venueRoutes = {
  "port": {
    "nameKo": "은카타베이 항구",
    "nameEn": "Nkhata Bay Port",
    "lat": -11.607396054564349,
    "lng": 34.3006527790571
  },
  "boatHours": [
    4,
    6
  ],
  "roadTimeFactor": [
    1.2,
    1.5
  ],
  "routes": {
    "-11.44313,34.00202": {
      "roadKm": 50.4,
      "roadMin": 39,
      "snapM": 61,
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCiNeTa]qAiJwBuIjEqEh@wJmKuNoBuBr@_CvFvD`TkG|NoMbNfBvX_BnK~CdH}HfUfAbOvIbQoAlb@nDrQ{@vSyB`LkSl\\mFzv@uGlR]|Lg]KuDhKwP~MqJdZgGlK_\\rNkGZ"
    },
    "-12.35322,33.55134": {
      "roadKm": 192.4,
      "roadMin": 143,
      "snapM": 58,
      "realMin": [
        266,
        325
      ],
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCiNeTa]qAiJwBuIjEqEh@wJmKuNoBuBr@aCdExDrUkG|NoMbNfBvX_BnK~CdHoHhRG`J`A~FvIbQoAlb@fDnP@nHoDlXkSl\\mFzv@uGlRq@xHjEvZpI~|AjCjLhD`GzGzFj^pMpgAjeAxTbYb]r]hOfFzh@lCjNpD`J`HdYl`@xa@ld@zMlHj_Ah[ze@jc@ji@|JlHnFbFjKjG|z@tS~m@b@dKuHhWd@|Y_AfDaGlEqYjG_GhFoR~_An@zM|NrQdDbKvAx_@{AlVkMnLiFfTgEn]|DtJdJbD~PuBrHhAzEzDlHnPtUfDbHtDz^bc@zThPpJfTjKtJ~A`PdEfGdJtChOaCjMjDpO]hFfBfB|CP`JwLdn@`@fFhEjHlW`Q`UlBpI`D~RjUnlArgAvhA`b@d]pH`NnG`KlLpSnf@hHjIdMnEnMAvMyEdSgRjOyH`PkBvY~@zKzCbJ`G`x@t|@nHzD`LfCfK`@b{BqH`W|BrJYhKyC`]}UxhA_b@`JwAdVn@l~@vXhPfBdLeAtX_Ij`AuPtHNxWbFd`AcO`NQjQhBrWmAnIuD|ImKfIqBhTpAxP~F|k@j_@rJ~Dt`@xDbRm@vSwHfLqHtJkSzPgPrBsF|Nc_ArDuLzI{L~T_Q`MqRvHiCfSxD|KbNrQrKnSzH|JvMbk@j^lNpPp|@~Qnd@dXpGRrb@gLrUaCdYPxe@|GnO~K~LxY~MxCrDdC~b@lo@xIlRjAtMfBfDbVjLjH|Fn}AnzA~GrD|GbA~k@EhIdDjEzFpBzMsChZzH|Yv@j`@p_@|t@tB|JkDrZoT|WeC`HNr{@pCrJtRj[tGpQp\\|Lni@yAlNpIjJ~BjC|CvAlPbBxDzUjPje@vc@vUp@vM}CjF\\`c@`_@tYjHpPAf[nVtHrC~Id@xh@mB`NvCtZfZzAxENnMxAzDxd@zWnApFwBjMh@bFzMhWhT~OzJjj@rD|EbHvCjcAy@|JdErRvPhQlD~m@qGjUmEzE_EbEyJ~Dms@nEeOtb@wc@hf@u|@pPkKzPaDnQX~QtFjMpKlKbT|GhHpr@pWbz@bl@|FjAzFw@~JiF~KCnP{CpTpC~J{@|F{DnIeP`HqGbaAcZvHNlZtG`T[jSjDb`@_LzUaAvNaIbTs@zED~F|B`t@nk@dFv@jRc@ve@jLzDsBxBwIfB}Af]VrJmEfCkFfMsl@jPqRzOiMbIkCpr@cGtPXhg@dTdb@lDnG`EpHhKpJxDlGXxa@uDfNlAtMvH|Zja@r]hiAbGjH~GfCvxAfMxp@tVprA|}@ja@pLtQ`JlCpDlFvWbQdVhSrPxLxUbLpLx{@jk@|OhFbe@~IxRnLjKpNh[ro@ph@f_Bdy@lhAwJfRzFj@"
    },
    "-11.82701,34.16079": {
      "roadKm": 42.1,
      "roadMin": 34,
      "snapM": 131,
      "realMin": [
        40,
        50
      ],
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMyGvONjGxCrEtGrCdJx@nKzFnB_BlKo@nKoIdENfO`G`]aCjTfPfStJzPmDrGl@xErElItCjCnH|BtAlY}@lOhBbCpDEvNbC|AlKr@bI`Q|Bf@vEyCbJwA~TvBjB`CdEtS`R|LvO_BtL|D|AfDi@jJxHfJlA~HtPfFbGRvDnCtPb@zH|B`Ck@nB{CB{DqHkJnDmWoFwMWkHv@iJnBgD|RwFvNdIbVtGnCMfCsCf@uLhC}D}AkLzMiXrEGjHtDvPoDnHmLdO_BpE}HpImBvLXjMhDbSbBvLiDvDThClGgCfNjD~VkIpRg@|LzAlGiAxGjC~H_@bItB|DxKhDlDvO|IvJnElc@hCtFfIzEzEd@`TwH|UiAxMdG`HG`F|BjIZbJtG|LyCvFz@hQQbErA`HfNbPnLLxMzEnJ`A`LrQv^dHzD|MbAdRlFhfAnf@pLvP~Pbl@bNhOfe@zUdMrCjNVxu@}CjUfBlOdFd^lTh_@`f@dd@~XnSjVxPxIu@`D|HdUg@fHkIjPiHdE"
    },
    "-10.43806,34.24441": {
      "roadKm": 204,
      "roadMin": 152,
      "snapM": 32,
      "realMin": [
        283,
        346
      ],
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCcLcRuCyAqZy@iJwBuIjEqEh@wJmKuNoBgF|DnD|VqGnOgM|L~A|Y_BnK~CdH}HfUfAbOvIbQoAlb@fDnP@nHoDlXkSl\\mFzv@uGlR_@bMic@QqOpAweCxo@__@r`@uUbPyNjNid@pm@yNxZu[`TmGjJuLxe@_DfZ{Trq@a@tKvBlUkAzK}e@b|@iDtJA`OxGzc@k@vg@u@|JuU~iAIpOvEja@B|JeDfQcFxIkJtIw^lQcT|[iIrG{d@jTcPrKq`@jNcJTga@}DaSYm[~Baw@hNgR\\an@iJe^uO_OoCsr@d@a|@mEyNbC_MnL{FlBu^Mq\\uF{u@m[sHu@iHhAoExCaQd]oHnGo`@rD}TrN_HnB{g@n@aMdEoSnNyObD_LaAm[uJek@eb@_Kk@eNxBaHCox@gV{c@wDw{@mMgQxAkQtJcKnBcw@}Fij@`B{SeB_o@cM}xCsVk}CUuc@wGmSnD_FWsKcIgOiDkIwHiPuG}S{Na`@yQkn@uj@kIsNqFyEebA_\\eiC}fAyRmPqKoU_PeKmf@mIot@yC{b@qG{I}Cq`A{j@qTi\\sL{J_\\ib@uKiIic@aP}oAiNkTqJ{g@qLyl@qWyn@_Q_XyQsIeK}M}k@qE{IoYmUysAqyA}FwN}Key@}C_K}~@ykAoYoQgMeOe_A_Y{X{KeQ{Pkb@_QoNqKsQuFwE{FkFyUcPoT_f@sPsPf@{LkEwCuHxCoLaAcHgSkOu[iPuP{Dqa@tFcICaDsA_PcTaHoFqLeU}JsL@qF~H}R{DcM}HwEyEiJmImFmKsNoc@qU_I_OkFgFeD_LsPuC}^MgNsFyK_BsU~Ec_@wBwXoLa]iDeF_EgFgJkMoGkIcAe\\Nwc@_JqHaGkPqGuOmUkIcE{Fg@qErAsKE}H}BsDwEiCaUhBsNiHsGaGyLGoOuAwFwEmFgPiGoJkQaUwKaCiFYsLgB_GaUaMaKeRwE]cDbBmIbSaCl@cF_AiDfE{JlC_AfEfAdC{AvA{EGySnEgDwDuCAeBmCqDu@oAaDsFf@qCgHXcDgAyBtAoBoBqHbCyA`@cD~B}@dAqJ_BqB_@qGmFyHwBc@}N~EoHm@}GfBcAg@`@eGiA_BqJlAwB}@rBoIoDuGByFr@oAxKmBsD_IpA}E{@kDvBsCxA_IiCm@}J~CcBsDgBYwKtDsEcIsD`B_Io@k@|AgEv@sAjBx@`EyD[qExGiAo@TyCsDpBkDoD~@{IjAq@`C`BlAaFpJcMfJu@zAsAxHLfEeCa@eCmSTqTnFsDGqCyB_LsSaMwHih@aQeg@}Ak[mKaEz@eDzKiFzFkFxAgIAmSoIsW}SyJoAqRl@yZmDqVuLoPnEk]xBgSfNcQhEgKdIaLpAaKbFqOiAaKvAiChCaAnElD`U]|F_CdGoDpDak@pZcWh^kJnF_o@pOe`@cEw[rAie@q@{XoLcUqYik@_f@yVma@gl@eu@ea@q{@gU}O_FSa]fD{RmIiSA{GhDuJhQwQvLeIjA_lAgPo|AxLg|AIwSoBo|B{`@caA}@iZgGyMq@o|@tIoImiAQmRpAeObCsLjc@asAxDmSbALnDlL"
    },
    "-10.38298,34.21591": {
      "roadKm": 205.2,
      "roadMin": 150,
      "snapM": 40,
      "realMin": [
        279,
        341
      ],
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCcLcRuCyAqZy@iJwBuIjEqEh@wJmKuNoBgF|DnD|VqGnOgM|L~A|Y_BnK~CdH}HfUfAbOvIbQoAlb@fDnP@nHoDlXkSl\\mFzv@uGlR_@bMic@QqOpAweCxo@__@r`@uUbPyNjNid@pm@yNxZu[`TmGjJuLxe@_DfZ{Trq@a@tKvBlUkAzK}e@b|@iDtJA`OxGzc@k@vg@u@|JuU~iAIpOvEja@B|JeDfQcFxIkJtIw^lQcT|[iIrG{d@jTcPrKq`@jNcJTga@}DaSYm[~Baw@hNgR\\an@iJe^uO_OoCsr@d@a|@mEyNbC_MnL{FlBu^Mq\\uF{u@m[sHu@iHhAoExCaQd]oHnGo`@rD}TrN_HnB{g@n@aMdEoSnNyObD_LaAm[uJek@eb@_Kk@eNxBaHCox@gV{c@wDw{@mMgQxAkQtJcKnBcw@}Fij@`B{SeB_o@cM}xCsVk}CUuc@wGmSnD_FWsKcIgOiDkIwHiPuG}S{Na`@yQkn@uj@kIsNqFyEebA_\\eiC}fAyRmPqKoU_PeKmf@mIot@yC{b@qG{I}Cq`A{j@qTi\\sL{J_\\ib@uKiIic@aP}oAiNkTqJ{g@qLyl@qWyn@_Q_XyQsIeK}M}k@qE{IoYmUysAqyA}FwN}Key@}C_K}~@ykAoYoQgMeOe_A_Y{X{KeQ{Pkb@_QoNqKsQuFwE{FkFyUcPoT_f@sPsPf@{LkEwCuHxCoLaAcHgSkOu[iPuP{Dqa@tFcICaDsA_PcTaHoFqLeU}JsL@qF~H}R{DcM}HwEyEiJmImFmKsNoc@qU_I_OkFgFeD_LsPuC}^MgNsFyK_BsU~Ec_@wBwXoLa]iDeF_EgFgJkMoGkIcAe\\Nwc@_JqHaGkPqGuOmUkIcE{Fg@qErAsKE}H}BsDwEiCaUhBsNiHsGaGyLGoOuAwFwEmFgPiGoJkQaUwKaCiFYsLgB_GaUaMaKeRwE]cDbBmIbSaCl@cF_AiDfE{JlC_AfEfAdC{AvA{EGySnEgDwDuCAeBmCqDu@oAaDsFf@qCgHXcDgAyBtAoBoBqHbCyA`@cD~B}@dAqJ_BqB_@qGmFyHwBc@}N~EoHm@}GfBcAg@`@eGiA_BqJlAwB}@rBoIoDuGByFr@oAxKmBsD_IpA}E{@kDvBsCxA_IiCm@}J~CcBsDgBYwKtDsEcIsD`B_Io@k@|AgEv@sAjBx@`EyD[qExGiAo@TyCsDpBkDoD~@{IjAq@`C`BlAaFpJcMfJu@zAsAxHLfEeCa@eCmSTqTnFsDGqCyB_LsSaMwHih@aQeg@}Ak[mKaEz@eDzKiFzFkFxAgIAmSoIsW}SyJoAqRl@yZmDqVuLoPnEk]xBgSfNcQhEgKdIaLpAaKbFqOiAaKvAiChCaAnElD`U]|F_CdGoDpDak@pZcWh^kJnF_o@pOe`@cE}YpAid@a@gIiBmQsIcUqYcj@ud@_Xwb@gl@eu@ea@q{@qMkKsH_Dcb@`D{RmIiSA{GhDuJhQwOtKwIjBsXoEyR}@qUoFmIg@o|AxLg|AIwSoBo|B{`@caA}@iZgGcLq@sPp@yg@tG_c@j@yiGeNf@_QuB]"
    },
    "-11.74540,34.23315": {
      "roadKm": 28.4,
      "roadMin": 22,
      "snapM": 78,
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNdFr`@aCn`@oEzPHlMyGvONjG`G~GrO`CnKzFnB_BlKo@nKoIdENfO`G`]aCjTfPfStJzPmDrGl@xErElItCjCnH|BtAlY}@lOhBbCpDEvNbC|AlKr@bI`Q|Bf@vEyCbJwA~TvBjB`CdEtSnPzKzDr@lKqBfNfF@hNxHfJtBhJlO|DbGRvDnCtPb@zH|B|DaBdAuE_IwLnDmWoFwMWkHv@iJnBgD|RwFvNdIbVtGnCMfCsCf@uLhC}D}AkLzMiXrEGjHtDvPoDnHmLdO_BpE}HpImBvLXjMhDbSbBbQeDfCnBl@nDgCfNjD~VkIpRg@|LzAlGiAxGjC~H_@bItB|DxKhDlDvO|IvJnElc@lBzEbJtFzEd@`TwHzVgAzLbG`HG`F|BjIZ~JxGtIyCfUh@|BwB"
    },
    "-11.72205,34.29656": {
      "roadKm": 24.2,
      "roadMin": 26,
      "snapM": 67,
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMyGvONjGxCrEtGrCdJx@nKzFnB_BlKo@nKoIdENfO`G`]aCjTfPfStJzPmDrGl@xErElItCjCnH|BtAlY}@lOhBbCpDEvNbC|AlKr@bI`Q|Bf@vEyCbJwA~TvBjB`CdEtSnPzKzDr@lKqBfNfF@hNxHfJtBhJlO|DbGRvDnCtPb@zH|B|DaBdAuE_IwLnDaVgGiRdBuShMgGtFq@vNdIbVtGnCMfCsCf@uLhC}D}AkLbL_WhEeApGxDvCHzPwEnF_K~PmChD}GcB{KjBqIvMc\\lO}NrDqOnHsOv@wIhRuPpJgBzTuj@`MsIpC]"
    },
    "-11.89113,33.59250": {
      "roadKm": 161.6,
      "roadMin": 126,
      "snapM": 52,
      "realMin": [
        235,
        287
      ],
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCcLcRuCyAqZy@iJwBuIjEqEh@wJmKuNoBgF|DnD|VqGnOgM|L~A|Y_BnK~CdH}HfUfAbOvIbQoAlb@nDrQu@rR_CdMkSl\\mFzv@uGlRq@xHjEvZfItzA`B`K|EtJdFtE``@vNpgAjeAxTbYb]r]hOfFzh@lCjNpD`J`HdYl`@pe@dg@njA~a@ze@jc@nJtClZrD~MxJvEnPrEbs@tS~m@l@`H_IlZd@|Y_AfDaGlEqYjG_GhFoR~_An@zM|NrQdDbKvAx_@{AlVkMnLqElQ{Ed]rA~IxD|DvEtAxRkBrHhAzEzDlHnPtUfDbHtDz^bc@zThPpJfTjKtJ~A`PdEfGdJtChOaCjMjDpO]hFfBfB|CP`JwLdn@`@fFhEjHlW`Q`UlBpI`D~RjUnlArgAvhA`b@d]pH`NnG`KlLzUxi@xLbJ`K|A|NiArGaDtTmSpKuFxOgCrTT~LbBhLhF|x@n}@nSrJxPnAb{BqHv]`CfPwD`]}UxhA_b@`JwAdVn@l~@vXhPfBdLeAtX_Ij`AuPtHNxWbFd`AcO`NQjQhBrWmAnIuD|ImKfIqBhTpAxP~F|k@j_@rJ~Dt`@xDjJAxPeDzR}JpEwEdHePzPgPrBsF|Nc_ArDuLzI{L~T_Q`MqRlJgCpQvD|KbNrQrKnSzH|JvMbk@j^lNpPp|@~Qnd@dXpGRrb@gLp\\mCdX|@~[nEfGxBtMbMbI|TvCvB|NfDfa@ll@xLxVjAtMfBfDbVjLjH|Fn}AnzAjNjFlk@KhMnEnDbFjB|HmCf_@zH|Yv@j`@p_@|t@lB|HmCb[iV`[cC~LpAhy@fVvb@nFdPdCtBpYrJni@yAlNpIjJ~BjC|CvAlPbBxDzUjPje@vc@vUp@vM}CjF\\`c@`_@tYjHpPAf[nVtHrC~Id@xh@mB`NvCtZfZzAxENnMxAzDxd@zWnApFwBjMh@bFzMhWhT~ObJxh@dIfJcArAam@pEsFbCsGvQoBlMRja@uAzCuExCid@~@qb@xRyJbCasAgMiPZkSdGyQfB_OlPeT`E}HpPcEjEue@xJyd@d@w}B~X}Fc@gL}EgGMi\\xGui@rUkt@{K_EnBaJrNuPiAwCdc@yVnC{TtNwFr@iIu@cBqC"
    },
    "-11.45963,34.00872": {
      "roadKm": 48.6,
      "roadMin": 37,
      "snapM": 67,
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCiNeTa]qAiJwBuIjEqEh@wJmKuNoBuBr@_CvFvD`TkG|NoMbNfBvX_BnK~CdH}HfUfAbOvIbQoAlb@nDrQ{@vSyB`LkSl\\mFzv@yH~VEjJnDxPoCb@fAxOgHrB"
    },
    "-10.99697,33.95852": {
      "roadKm": 113.5,
      "roadMin": 83,
      "snapM": 5,
      "realMin": [
        155,
        189
      ],
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCcLcRuCyAqZy@iJwBuIjEqEh@wJmKuNoBgF|DnD|VqGnOgM|L~A|Y_BnK~CdH}HfUfAbOvIbQoAlb@fDnP@nHoDlXkSl\\mFzv@uGlR]|Lkc@KqOpAweCxo@__@r`@uUbPyNjNid@pm@yNxZwXpQaHrHmMnd@qEx_@{Trq@a@tKvBlUkAzK}e@b|@uDvLH~LtGbb@Oj]mA`WuU~iA@dSvExa@sAhRkCvHmHfKgf@vWqWj_@wk@pYcPrKmUxJ_LzBmOOqa@{DcOHa`@pD{n@lLwNb@qq@oJe^uOgWeDkj@z@a`AiEyJ~B_MnL{FlBmb@]yXeF{u@m[sHu@iHhAoExCaQd]oHnGo`@rD}TrN_HnB{g@n@aMdEsWpPiN`BkIaAa^eLka@u\\eF_C_Kk@eNxBaHCox@gV{c@wDw{@mMgQxAkQtJcKnBcw@}Fij@`B{SeB_o@cM}xCsVk}CUuc@wG_XjDmEuAsGaGgOiDkIwHiPuG}S{Na`@yQkn@uj@kIsNqFyEebA_\\eiC}fAyRmPqKoU_PeKmf@mIot@yC{b@qG{I}CadAmn@kLkS{[u\\|K_Lk@gF"
    },
    "-11.36165,33.87877": {
      "roadKm": 68.4,
      "roadMin": 50,
      "snapM": 3,
      "realMin": [
        93,
        114
      ],
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCcLcRuCyAqZy@iJwBuIjEqEh@wJmKuNoBgF|DnD|VqGnOgM|L~A|Y_BnK~CdH}HfUfAbOvIbQoAlb@fDnP@nHoDlXkSl\\mFzv@uGlR]|Lkc@KqOpAweCxo@__@r`@uUbPyNjNid@pm@yNxZwXpQaHrHmMnd@qEx_@{Trq@a@tKvBlUkAzK}e@b|@iDtJA`OxGzc@k@vg@u@|JuU~iA@dSvExa@u@jOwBvHuNjRuc@nU_R~YiIrG{d@jTmSlMcR~HmKfB"
    },
    "-11.60612,34.28364": {
      "roadKm": 2.5,
      "roadMin": 3,
      "snapM": 100,
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjArJ|LhAzDqBzQfFfc@u@lP"
    },
    "-11.87244,33.79949": {
      "roadKm": 116.1,
      "roadMin": 89,
      "snapM": 105,
      "realMin": [
        166,
        203
      ],
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCcLcRuCyAqZy@iJwBuIjEqEh@wJmKuNoBgF|DnD|VqGnOgM|L~A|Y_BnK~CdH}HfUfAbOvIbQoAlb@nDrQu@rR_CdMkSl\\mFzv@uGlRq@xHjEvZpI~|AjCjLhD`GzGzFj^pMpgAjeAxTbYb]r]hOfFzh@lCjNpD`J`HdYl`@pe@dg@njA~a@ze@jc@nJtClZrD~MxJvEnPrEbs@tS~m@l@`H_IlZd@|Y_AfDaGlEqYjG_GhFoR~_An@zM|NrQdDbKvAx_@{AlVkMnLqElQ{Ed]rA~IxD|DvEtAxRkBrHhAzEzDlHnPtUfDbHtDz^bc@zThPpJfTjKtJ~A`PdEfGdJtChOaCjMjDpO]hFfBfB|CP`JwLdn@`@fFhEjHlW`Q`UlBpI`D~RjUnlArgAvhA`b@d]pH`NnG`KlLzUxi@xLbJ`K|A|NiArGaDtTmSpKuFxOgCrTT~LbBhLhF|x@n}@nSrJxPnAb{BqHv]`CfPwD`]}UxhA_b@`JwAdVn@l~@vXhPfBdLeAtX_Ij`AuPtHNxWbFd`AcO`NQjQhBrWmAnIuD|ImKfIqBhTpAxP~F|k@j_@rJ~Dt`@xDjJAxPeDzR}JpEwEdHePzPgPrBsF|Nc_ArDuLzI{L~T_Q`MqRvHiCfSxD|KbNrQrKnSzH|JvMbk@j^lNpPp|@~Qnd@dXpGRrm@wNtZw@U{B"
    },
    "-11.45268,33.41946": {
      "roadKm": 138.8,
      "roadMin": 145,
      "snapM": 5,
      "realMin": [
        300,
        300
      ],
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCiNeTa]qAiJwBuIjEqEh@wJmKuNoBuBr@_CvFvD`TkG|NoMbNfBvX_BnK~CdH}HfUfAbOvIbQoAlb@nDrQ{@vSyB`LkSl\\mFzv@uGlR_@bMic@QqOpAweCxo@gJvHoNzQu\\rV}VvWmZtb@iOj[o^~VyEpJmIp\\cG~c@iSlm@a@tKvBlUkAzK}e@b|@iDtJA`OxGzc@k@vg@u@|JuU~iA@dSvExa@u@jOiDtKcMlOuc@nUmUl]wk@pYcPrKmUxJ_LzBs@rFoJzJex@dg@wJxDmu@zKaHfKwRbj@qAdYn@zEpK`RxQ|MzFtRlDhFhE|Bx_A`Utf@jc@fs@~b@|G`IdDvK|CjYtX~`@f@jHcAnGnBrc@`F`RqIp`@qK|IoBxH[pJlHfXx~AbaB`Uhf@`PhStTjNt_@n`@vY|g@l@dQpJrOmCha@~@|IfClBzMlB~HzDl@~AWlCgKhLrJpY[dHyBnLeGhFkGhOdH~Lt@tOu@zH}ItL^vEaBlCxFnQqBnAmDK_BdDkE~AiElOsHlL_UnJkz@pvAcFnU{Qt\\aFf\\uQpc@UtIhCfVjEjMbf@~XxGfAlNxKtH~@nIY|InDfZaDhb@dCt^`QtMzBpFhErInn@~PvPxExBvwBwUdt@hCd|@zXnLxLfIzE`j@fAzw@wL`FpEjFlQv[zj@lPfNkVtMcHlG{@rIvB|TeCpSuUr\\oEjRrJpLtBjRnGzBcBf^~AzSzOt^tAxJhFbMvA~NnD~MFvKfF~PQvY|Jv[cCvJRnToH`]of@`~@kCbJLlLvRn~AIzGeDxImTzVybAjS}H`Eed@hmAuKj}A}BlNuLbe@sg@noAqGjsDcJ~a@"
    },
    "-11.39626,34.00939": {
      "roadKm": 56.3,
      "roadMin": 47,
      "snapM": 83,
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhB~A|Ci@pBcf@bKsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCiNeTa]qAiJwBuIjEqEh@wJmKuNoBuBr@_CvFvD`TkG|NoMbNfBvX_BnK~CdH}HfUfAbOvIbQoAlb@nDrQ{@vSyB`LkSl\\mFzv@uGlRe@fMcc@UqOpAw{Bbk@mPvIqWpZmA{FmBw@HyGoPqFmvA|Cce@dNqGqJqDrAkBWoPoNmIkEtDqN"
    },
    "-12.19863,33.66767": {
      "roadKm": 168.9,
      "roadMin": 126,
      "snapM": 3,
      "realMin": [
        235,
        287
      ],
      "line": "fbzeAskjpEhCdCXhGu@vA{FbCoJmDkBjAlLvPNbGoBlNfFbb@cC~^oEzPHlMgGpMUlEfAhFlExDpRlDfQ|LnB`[{@hFaJdMqYjTgd@fIsHlEmWre@_[|X{g@b_@kTl\\ya@`\\g]vz@oSnS}f@v^un@CgM~EqRhX}BvGiBpdArAdQqC~Ckc@vVsIfOgGrc@Gz]pNxz@iFzW}HxR}Et^}NvRaAxFr@dFnPxR|KbZ_N~KkDdJaLjD_F~IXtEdKpTd@tGmPvb@GbQh@rDrCrCpTvDnSfJl@bGcHjSxAtHnTlHdQ`JbKhBhAtA?xCmBzAic@fIsXxVuGVsGwE}IsB{B\\}GlHe@fNaIrEuC|`@yNvIcRy@}IrKaK`AoPhLyF`SoPj@aTjIwShUqFE{CbC_MrUkL|HoJDiIeFyI}@eMeGqO?{DkCiNeTa]qAiJwBuIjEqEh@wJmKuNoBuBr@aCdExDrUkG|NoMbNfBvX_BnK~CdHoHhRG`J`A~FvIbQoAlb@fDnP@nHoDlXkSl\\mFzv@uGlRq@xHjEvZpI~|AjCjLhD`GzGzFj^pMpgAjeAxTbYb]r]hOfFzh@lCjNpD`J`HdYl`@xa@ld@zMlHj_Ah[ze@jc@ji@|JlHnFbFjKjG|z@tS~m@b@dKuHhWd@|Y_AfDaGlEqYjG_GhFoR~_An@zM|NrQdDbKvAx_@{AlVkMnLqElQ{Ed]dCbLbEzCtE|@~PuBrHhAzEzDlHnPtUfDbHtDz^bc@zThPpJfTjKtJ~A`PdEfGdJtChOaCjMjDpO]hFfBfB|CP`JwLdn@`@fFhEjHlW`Q`UlBpI`D~RjUnlArgAvhA`b@d]pH`NnG`KlLpSnf@hHjIdMnEnMAvMyEdSgRjOyH`PkBvY~@zKzCbJ`G`x@t|@nHzD`LfCfK`@b{BqH`W|BrJYhKyC`]}UxhA_b@`JwAdVn@l~@vXhPfBdLeAtX_Ij`AuPtHNxWbFd`AcO`NQjQhBrWmAnIuD|ImKfIqBhTpAxP~F|k@j_@rJ~Dt`@xDbRm@vSwHfLqHtJkSzPgPrBsF|Nc_ArDuLzI{L~T_Q`MqRvHiCfSxD|KbNrQrKnSzH|JvMbk@j^lNpPp|@~Qnd@dXpGRrb@gLrUaCdYPxe@|GnO~K~LxY~MxCrDdC~b@lo@xIlRjAtMfBfDbVjLjH|Fn}AnzA~GrD|GbA~k@EhIdDjEzFpBzMsChZzH|Yv@j`@p_@|t@tB|JkDrZoT|WeC`HNr{@pCrJtRj[tGpQp\\|Lni@yAlNpIjJ~BjC|CvAlPbBxDzUjPje@vc@vUp@vM}CjF\\`c@`_@tYjHpPAf[nVtHrC~Id@xh@mB`NvCtZfZzAxENnMxAzDxd@zWnApFwBjMh@bFzMhWhT~OzJjj@rD|EbHvCjcAy@|JdErRvPhQlD~m@qGjUmEzE_EbEyJ~Dms@nEeOtb@wc@jd@qz@zMcK~Q}E~TH~QtFjMpKlKbT|GhHpr@pWbz@bl@|FjAzFw@~JiF~KCnP{CpTpC~J{@|F{DnIeP`HqGbaAcZvHNlZtG`T[jSjDb`@_LzUaAvNaIbTs@zED~F|B`t@nk@dFv@jRc@ve@jLzDsBxBwIfB}Af]VrJmEfCkFfMsl@vYwZ`@aC"
    }
  }
};
