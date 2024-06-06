import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import {
    PAYMENT_METHOD_PAYPAL,
    PAYMENT_METHOD_PAYTM,
    PAYMENT_METHOD_STRIPE,
    PAYMENT_METHOD_NONE,
    MIMETYPE_IMAGE,
} from "../../../ui-config/constants";
import {
    SITE_SETTINGS_TITLE,
    SITE_SETTINGS_SUBTITLE,
    SITE_SETTINGS_LOGO,
    SITE_SETTINGS_PAGE_HEADING,
    SITE_SETTINGS_CURRENCY,
    SITE_ADMIN_SETTINGS_STRIPE_SECRET,
    SITE_ADMIN_SETTINGS_PAYPAL_SECRET,
    SITE_ADMIN_SETTINGS_PAYTM_SECRET,
    SITE_SETTINGS_SECTION_GENERAL,
    SITE_SETTINGS_SECTION_PAYMENT,
    SITE_ADMIN_SETTINGS_PAYMENT_METHOD,
    SITE_SETTINGS_STRIPE_PUBLISHABLE_KEY_TEXT,
    APP_MESSAGE_SETTINGS_SAVED,
    SITE_CUSTOMISATIONS_SETTING_HEADER,
    SITE_CUSTOMISATIONS_SETTING_CODEINJECTION_HEAD,
    HEADER_SECTION_PAYMENT_CONFIRMATION_WEBHOOK,
    SUBHEADER_SECTION_PAYMENT_CONFIRMATION_WEBHOOK,
    BUTTON_SAVE,
    SITE_SETTINGS_PAYMENT_METHOD_NONE_LABEL,
    SITE_CUSTOMISATIONS_SETTING_CODEINJECTION_BODY,
    SITE_APIKEYS_SETTING_HEADER,
    APIKEY_NEW_BUTTON,
    APIKEY_EXISTING_HEADER,
    APIKEY_EXISTING_TABLE_HEADER_CREATED,
    APIKEY_EXISTING_TABLE_HEADER_NAME,
    APIKEY_REMOVE_BTN,
    APIKEY_REMOVE_DIALOG_HEADER,
    APIKYE_REMOVE_DIALOG_DESC,
    SITE_MAILS_HEADER,
    SITE_MAILING_ADDRESS_SETTING_HEADER,
    SITE_MAILING_ADDRESS_SETTING_EXPLANATION,
} from "../../../ui-config/strings";
import { FetchBuilder, capitalize } from "@courselit/utils";
import { decode, encode } from "base-64";
import { AppMessage, Profile } from "@courselit/common-models";
import type { SiteInfo, Address, Auth } from "@courselit/common-models";
import type { AppDispatch, AppState } from "@courselit/state-management";
import { actionCreators } from "@courselit/state-management";
import currencies from "../../../data/iso4217.json";
import {
    Select,
    MediaSelector,
    Tabs,
    Form,
    FormField,
    Button,
    Link,
    Table,
    TableHead,
    TableBody,
    TableRow,
    Dialog2,
} from "@courselit/components-library";

const { networkAction, newSiteInfoAvailable, setAppMessage } = actionCreators;

interface SettingsProps {
    siteinfo: SiteInfo;
    auth: Auth;
    profile: Profile;
    dispatch: (...args: any[]) => void;
    address: Address;
    networkAction: boolean;
    loading: boolean;
    selectedTab:
        | typeof SITE_SETTINGS_SECTION_GENERAL
        | typeof SITE_SETTINGS_SECTION_PAYMENT
        | typeof SITE_MAILS_HEADER
        | typeof SITE_CUSTOMISATIONS_SETTING_HEADER
        | typeof SITE_APIKEYS_SETTING_HEADER;
}

const Settings = (props: SettingsProps) => {
    const [settings, setSettings] = useState<Partial<SiteInfo>>({});
    const [newSettings, setNewSettings] = useState<Partial<SiteInfo>>({});
    const [apikeyPage, setApikeyPage] = useState(1);
    const [apikeys, setApikeys] = useState([]);
    const selectedTab = [
        SITE_SETTINGS_SECTION_GENERAL,
        SITE_SETTINGS_SECTION_PAYMENT,
        SITE_MAILS_HEADER,
        SITE_CUSTOMISATIONS_SETTING_HEADER,
        SITE_APIKEYS_SETTING_HEADER,
    ].includes(props.selectedTab)
        ? props.selectedTab
        : SITE_SETTINGS_SECTION_GENERAL;

    const fetch = new FetchBuilder()
        .setUrl(`${props.address.backend}/api/graph`)
        .setIsGraphQLEndpoint(true);

    useEffect(() => {
        loadAdminSettings();
    }, []);

    useEffect(() => {
        props.dispatch(
            newSiteInfoAvailable({
                title: settings.title || "",
                subtitle: settings.subtitle || "",
                logo: settings.logo,
                currencyISOCode: settings.currencyISOCode,
                paymentMethod: settings.paymentMethod,
                stripePublishableKey: settings.stripePublishableKey,
                codeInjectionHead: settings.codeInjectionHead
                    ? encode(settings.codeInjectionHead)
                    : "",
                codeInjectionBody: settings.codeInjectionBody
                    ? encode(settings.codeInjectionBody)
                    : "",
                mailingAddress: settings.mailingAddress || "",
            }),
        );
    }, [settings]);

    const loadAdminSettings = async () => {
        const query = `
            query {
                settings: getSiteInfo {
                    settings {
                        title,
                        subtitle,
                        logo {
                            mediaId,
                            originalFileName,
                            mimeType,
                            size,
                            access,
                            file,
                            thumbnail,
                            caption
                        },
                        currencyISOCode,
                        paymentMethod,
                        stripePublishableKey,
                        codeInjectionHead,
                        codeInjectionBody,
                        mailingAddress
                    }
                },
                apikeys: getApikeys {
                    name,
                    keyId,
                    createdAt
                }
            }`;
        try {
            const fetchRequest = fetch.setPayload(query).build();
            const response = await fetchRequest.exec();
            if (response.settings.settings) {
                setSettingsState(response.settings.settings);
            }
            if (response.apikeys) {
                setApikeys(response.apikeys);
            }
        } catch (e) {}
    };

    const setSettingsState = (settingsResponse: SiteInfo) => {
        if (settingsResponse.codeInjectionHead) {
            settingsResponse.codeInjectionHead = decode(
                settingsResponse.codeInjectionHead,
            );
        }
        if (settingsResponse.codeInjectionBody) {
            settingsResponse.codeInjectionBody = decode(
                settingsResponse.codeInjectionBody,
            );
        }
        const settingsResponseWithNullsRemoved = {
            title: settingsResponse.title || "",
            subtitle: settingsResponse.subtitle || "",
            logo: settingsResponse.logo,
            currencyISOCode: settingsResponse.currencyISOCode || "",
            paymentMethod: settingsResponse.paymentMethod || "",
            stripePublishableKey: settingsResponse.stripePublishableKey || "",
            codeInjectionHead: settingsResponse.codeInjectionHead || "",
            codeInjectionBody: settingsResponse.codeInjectionBody || "",
            mailingAddress: settingsResponse.mailingAddress || "",
        };
        setSettings(
            Object.assign({}, settings, settingsResponseWithNullsRemoved),
        );
        setNewSettings(
            Object.assign({}, newSettings, settingsResponseWithNullsRemoved),
        );
    };

    const handleSettingsSubmit = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();
        const query = `
            mutation {
                settings: updateSiteInfo(siteData: {
                    title: "${newSettings.title}",
                    subtitle: "${newSettings.subtitle}",
                    logo: ${
                        newSettings.logo && newSettings.logo.mediaId
                            ? `{
                                mediaId: "${newSettings.logo.mediaId}",
                                originalFileName: "${
                                    newSettings.logo.originalFileName
                                }",
                                mimeType: "${newSettings.logo.mimeType}",
                                size: ${newSettings.logo.size},
                                access: "${newSettings.logo.access}",
                                file: ${
                                    newSettings.logo.access === "public"
                                        ? `"${newSettings.logo.file}"`
                                        : null
                                },
                                thumbnail: "${newSettings.logo.thumbnail}",
                                caption: "${newSettings.logo.caption}"
                            }`
                            : null
                    } 
                }) {
                    settings {
                        title,
                        subtitle,
                        logo {
                            mediaId,
                            originalFileName,
                            mimeType,
                            size,
                            access,
                            file,
                            thumbnail,
                            caption
                        },
                        currencyISOCode,
                        paymentMethod,
                        stripePublishableKey,
                        codeInjectionHead,
                        codeInjectionBody,
                        mailingAddress
                    }
                }
            }`;

        try {
            const fetchRequest = fetch.setPayload(query).build();
            props.dispatch(networkAction(true));
            const response = await fetchRequest.exec();
            if (response.settings.settings) {
                setSettingsState(response.settings.settings);
                props.dispatch(
                    setAppMessage(new AppMessage(APP_MESSAGE_SETTINGS_SAVED)),
                );
            }
        } catch (e: any) {
            props.dispatch(setAppMessage(new AppMessage(e.message)));
        } finally {
            props.dispatch(networkAction(false));
        }
    };

    const handleCodeInjectionSettingsSubmit = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!newSettings.codeInjectionHead && !newSettings.codeInjectionBody) {
            return;
        }

        const query = `
        mutation {
            settings: updateSiteInfo(siteData: {
                codeInjectionHead: "${encode(newSettings.codeInjectionHead)}",
                codeInjectionBody: "${encode(newSettings.codeInjectionBody)}"
            }) {
                settings {
                    title,
                    subtitle,
                    logo {
                        mediaId,
                        originalFileName,
                        mimeType,
                        size,
                        access,
                        file,
                        thumbnail,
                        caption
                    },
                    currencyISOCode,
                    paymentMethod,
                    stripePublishableKey,
                    codeInjectionHead,
                    codeInjectionBody,
                    mailingAddress,
                }
            }
        }`;

        try {
            const fetchRequest = fetch.setPayload(query).build();
            props.dispatch(networkAction(true));
            const response = await fetchRequest.exec();
            if (response.settings.settings) {
                setSettingsState(response.settings.settings);
                props.dispatch(
                    setAppMessage(new AppMessage(APP_MESSAGE_SETTINGS_SAVED)),
                );
            }
        } catch (e: any) {
            props.dispatch(setAppMessage(new AppMessage(e.message)));
        } finally {
            props.dispatch(networkAction(false));
        }
    };

    const handleMailsSettingsSubmit = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!newSettings.mailingAddress) {
            return;
        }

        const query = `
        mutation {
            settings: updateSiteInfo(siteData: {
                mailingAddress: "${newSettings.mailingAddress}"
            }) {
                settings {
                    title,
                    subtitle,
                    logo {
                        mediaId,
                        originalFileName,
                        mimeType,
                        size,
                        access,
                        file,
                        thumbnail,
                        caption
                    },
                    currencyISOCode,
                    paymentMethod,
                    stripePublishableKey,
                    codeInjectionHead,
                    codeInjectionBody,
                    mailingAddress,
                }
            }
        }`;

        try {
            const fetchRequest = fetch.setPayload(query).build();
            props.dispatch(networkAction(true));
            const response = await fetchRequest.exec();
            if (response.settings.settings) {
                setSettingsState(response.settings.settings);
                props.dispatch(
                    setAppMessage(new AppMessage(APP_MESSAGE_SETTINGS_SAVED)),
                );
            }
        } catch (e: any) {
            props.dispatch(setAppMessage(new AppMessage(e.message)));
        } finally {
            props.dispatch(networkAction(false));
        }
    };

    const onChangeData = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e) {
            return;
        }

        const change = Object.prototype.hasOwnProperty.call(e, "mediaId")
            ? {
                  logo: e,
              }
            : { [e.target.name]: e.target.value };
        setNewSettings(Object.assign({}, newSettings, change));
    };

    const handlePaymentSettingsSubmit = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();
        const query = `
            mutation {
                settings: updatePaymentInfo(siteData: {
                    currencyISOCode: "${newSettings.currencyISOCode}",
                    paymentMethod: "${newSettings.paymentMethod}",
                    stripePublishableKey: "${newSettings.stripePublishableKey}"
                    ${
                        newSettings.stripeSecret
                            ? `, stripeSecret: "${newSettings.stripeSecret}"`
                            : ""
                    }
                }) {
                    settings {
                        title,
                        subtitle,
                        logo {
                            mediaId,
                            originalFileName,
                            mimeType,
                            size,
                            access,
                            file,
                            thumbnail,
                            caption
                        },
                        currencyISOCode,
                        paymentMethod,
                        stripePublishableKey,
                        codeInjectionHead,
                        codeInjectionBody,
                        mailingAddress,
                    }
                }
            }`;

        try {
            const fetchRequest = fetch.setPayload(query).build();
            props.dispatch(networkAction(true));
            const response = await fetchRequest.exec();
            if (response.settings.settings) {
                setSettingsState(response.settings.settings);
                props.dispatch(
                    setAppMessage(new AppMessage(APP_MESSAGE_SETTINGS_SAVED)),
                );
            }
        } catch (e: any) {
            props.dispatch(setAppMessage(new AppMessage(e.message)));
        } finally {
            props.dispatch(networkAction(false));
        }
    };

    const getPaymentSettings = (getNewSettings = false) => ({
        currencyISOCode: getNewSettings
            ? newSettings.currencyISOCode
            : settings.currencyISOCode,
        paymentMethod: getNewSettings
            ? newSettings.paymentMethod
            : settings.paymentMethod,
        stripePublishableKey: getNewSettings
            ? newSettings.stripePublishableKey
            : settings.stripePublishableKey,
        stripeSecret: getNewSettings
            ? newSettings.stripeSecret
            : settings.stripeSecret,
        paypalSecret: getNewSettings
            ? newSettings.paypalSecret
            : settings.paypalSecret,
        paytmSecret: getNewSettings
            ? newSettings.paytmSecret
            : settings.paytmSecret,
    });

    const removeApikey = async (keyId: string) => {
        const query = `
            mutation {
                removed: removeApikey(keyId: "${keyId}")
            }
        `;
        try {
            const fetchRequest = fetch.setPayload(query).build();
            props.dispatch(networkAction(true));
            await fetchRequest.exec();
            setApikeys(
                apikeys.filter(
                    (item: Record<string, unknown>) => item.keyId !== keyId,
                ),
            );
        } catch (e: any) {
            props.dispatch(setAppMessage(new AppMessage(e.message)));
        } finally {
            props.dispatch(networkAction(false));
        }
    };

    return (
        <div>
            <div className="flex justify-between items-baseline">
                <h1 className="text-4xl font-semibold mb-4">
                    {SITE_SETTINGS_PAGE_HEADING}
                </h1>
            </div>
            <Tabs
                items={[
                    SITE_SETTINGS_SECTION_GENERAL,
                    SITE_SETTINGS_SECTION_PAYMENT,
                    SITE_MAILS_HEADER,
                    SITE_CUSTOMISATIONS_SETTING_HEADER,
                    SITE_APIKEYS_SETTING_HEADER,
                ]}
                defaultValue={selectedTab}
            >
                <Form
                    onSubmit={handleSettingsSubmit}
                    className="flex flex-col gap-4 pt-4"
                >
                    <FormField
                        label={SITE_SETTINGS_TITLE}
                        name="title"
                        value={newSettings.title || ""}
                        onChange={onChangeData}
                        required
                    />
                    <FormField
                        label={SITE_SETTINGS_SUBTITLE}
                        name="subtitle"
                        value={newSettings.subtitle || ""}
                        onChange={onChangeData}
                    />
                    <MediaSelector
                        auth={props.auth}
                        profile={props.profile}
                        dispatch={props.dispatch}
                        address={props.address}
                        title={SITE_SETTINGS_LOGO}
                        src={
                            (newSettings.logo && newSettings.logo.thumbnail) ||
                            (props.siteinfo.logo &&
                                props.siteinfo.logo.thumbnail)
                        }
                        srcTitle={
                            (newSettings.logo &&
                                newSettings.logo.originalFileName) ||
                            (props.siteinfo.logo &&
                                props.siteinfo.logo.originalFileName)
                        }
                        onSelection={onChangeData}
                        mimeTypesToShow={[...MIMETYPE_IMAGE]}
                        access="public"
                        strings={{}}
                    />
                    <div>
                        <Button
                            type="submit"
                            value={BUTTON_SAVE}
                            color="primary"
                            disabled={
                                JSON.stringify({
                                    title: settings.title,
                                    subtitle: settings.subtitle,
                                    logo: settings.logo,
                                }) ===
                                    JSON.stringify({
                                        title: newSettings.title,
                                        subtitle: newSettings.subtitle,
                                        logo: newSettings.logo,
                                    }) ||
                                !newSettings.title ||
                                props.networkAction
                            }
                        >
                            {BUTTON_SAVE}
                        </Button>
                    </div>
                </Form>
                <Form
                    onSubmit={handlePaymentSettingsSubmit}
                    className="flex flex-col gap-4 pt-4"
                >
                    <Select
                        title={SITE_SETTINGS_CURRENCY}
                        options={currencies.map((currency) => ({
                            label: currency.Currency,
                            value: currency.AlphabeticCode,
                        }))}
                        value={newSettings.currencyISOCode?.toUpperCase() || ""}
                        onChange={(value) =>
                            setNewSettings(
                                Object.assign({}, newSettings, {
                                    currencyISOCode: value,
                                }),
                            )
                        }
                    />
                    <Select
                        title={SITE_ADMIN_SETTINGS_PAYMENT_METHOD}
                        value={newSettings.paymentMethod || PAYMENT_METHOD_NONE}
                        options={[
                            {
                                label: capitalize(
                                    PAYMENT_METHOD_STRIPE.toLowerCase(),
                                ),
                                value: PAYMENT_METHOD_STRIPE,
                            },
                        ]}
                        onChange={(value) =>
                            setNewSettings(
                                Object.assign({}, newSettings, {
                                    paymentMethod: value,
                                }),
                            )
                        }
                        placeholderMessage={
                            SITE_SETTINGS_PAYMENT_METHOD_NONE_LABEL
                        }
                    />

                    {newSettings.paymentMethod === PAYMENT_METHOD_STRIPE && (
                        <>
                            <FormField
                                label={
                                    SITE_SETTINGS_STRIPE_PUBLISHABLE_KEY_TEXT
                                }
                                name="stripePublishableKey"
                                value={newSettings.stripePublishableKey || ""}
                                onChange={onChangeData}
                            />
                            <FormField
                                label={SITE_ADMIN_SETTINGS_STRIPE_SECRET}
                                name="stripeSecret"
                                type="password"
                                value={newSettings.stripeSecret || ""}
                                onChange={onChangeData}
                                sx={{ mb: 2 }}
                                autoComplete="off"
                            />
                            <div className="flex flex-col gap-2">
                                <p className="font-medium">
                                    {
                                        HEADER_SECTION_PAYMENT_CONFIRMATION_WEBHOOK
                                    }
                                </p>
                                <p className="text-slate-600">
                                    {
                                        SUBHEADER_SECTION_PAYMENT_CONFIRMATION_WEBHOOK
                                    }
                                </p>
                                <p>
                                    <Link
                                        href={`${props.address.backend}/api/payment/webhook`}
                                        className="hover:underline"
                                    >
                                        {`${props.address.backend}/api/payment/webhook`}
                                    </Link>
                                </p>
                            </div>
                        </>
                    )}
                    {newSettings.paymentMethod === PAYMENT_METHOD_PAYPAL && (
                        <FormField
                            label={SITE_ADMIN_SETTINGS_PAYPAL_SECRET}
                            name="paypalSecret"
                            type="password"
                            value={newSettings.paypalSecret || ""}
                            onChange={onChangeData}
                            disabled={true}
                        />
                    )}
                    {newSettings.paymentMethod === PAYMENT_METHOD_PAYTM && (
                        <FormField
                            label={SITE_ADMIN_SETTINGS_PAYTM_SECRET}
                            name="paytmSecret"
                            type="password"
                            value={newSettings.paytmSecret || ""}
                            onChange={onChangeData}
                            disabled={true}
                        />
                    )}
                    <div>
                        <Button
                            type="submit"
                            value={BUTTON_SAVE}
                            disabled={
                                JSON.stringify(getPaymentSettings()) ===
                                JSON.stringify(getPaymentSettings(true))
                            }
                        >
                            {BUTTON_SAVE}
                        </Button>
                    </div>
                </Form>
                <Form
                    onSubmit={handleMailsSettingsSubmit}
                    className="flex flex-col gap-4 pt-4"
                >
                    <FormField
                        component="textarea"
                        label={SITE_MAILING_ADDRESS_SETTING_HEADER}
                        name="mailingAddress"
                        value={newSettings.mailingAddress || ""}
                        onChange={onChangeData}
                        multiline
                        rows={5}
                    />
                    <p className="text-xs text-slate-500">
                        {SITE_MAILING_ADDRESS_SETTING_EXPLANATION}
                    </p>
                    {/* <FormField
                        component="textarea"
                        label={SITE_CUSTOMISATIONS_SETTING_CODEINJECTION_BODY}
                        name="codeInjectionBody"
                        value={newSettings.codeInjectionBody || ""}
                        onChange={onChangeData}
                        multiline
                        rows={10}
                    /> */}
                    <div>
                        <Button
                            type="submit"
                            value={BUTTON_SAVE}
                            color="primary"
                            variant="outlined"
                            disabled={
                                settings.mailingAddress ===
                                    newSettings.mailingAddress ||
                                props.networkAction
                            }
                        >
                            {BUTTON_SAVE}
                        </Button>
                    </div>
                </Form>
                <Form
                    onSubmit={handleCodeInjectionSettingsSubmit}
                    className="flex flex-col gap-4 pt-4"
                >
                    <FormField
                        component="textarea"
                        label={SITE_CUSTOMISATIONS_SETTING_CODEINJECTION_HEAD}
                        name="codeInjectionHead"
                        value={newSettings.codeInjectionHead || ""}
                        onChange={onChangeData}
                        multiline
                        rows={10}
                    />
                    <FormField
                        component="textarea"
                        label={SITE_CUSTOMISATIONS_SETTING_CODEINJECTION_BODY}
                        name="codeInjectionBody"
                        value={newSettings.codeInjectionBody || ""}
                        onChange={onChangeData}
                        multiline
                        rows={10}
                    />
                    <div>
                        <Button
                            type="submit"
                            value={BUTTON_SAVE}
                            color="primary"
                            variant="outlined"
                            disabled={
                                (settings.codeInjectionHead ===
                                    newSettings.codeInjectionHead &&
                                    settings.codeInjectionBody ===
                                        newSettings.codeInjectionBody) ||
                                props.networkAction
                            }
                        >
                            {BUTTON_SAVE}
                        </Button>
                    </div>
                </Form>
                <div className="flex flex-col gap-4 pt-4">
                    <div className="flex justify-between">
                        <h2 className="text-lg font-semibold">
                            {APIKEY_EXISTING_HEADER}
                        </h2>
                        <Link href="/dashboard/settings/apikeys/new">
                            <Button>{APIKEY_NEW_BUTTON}</Button>
                        </Link>
                    </div>
                    <Table aria-label="API keys" className="mb-4">
                        <TableHead className="border-0 border-b border-slate-200">
                            <td>{APIKEY_EXISTING_TABLE_HEADER_NAME}</td>
                            <td>{APIKEY_EXISTING_TABLE_HEADER_CREATED}</td>
                            <td align="right"> </td>
                        </TableHead>
                        <TableBody
                            loading={props.loading}
                            endReached={true}
                            page={apikeyPage}
                            onPageChange={(value: number) => {
                                setApikeyPage(value);
                            }}
                        >
                            {apikeys.map(
                                (
                                    item: Record<string, unknown>,
                                    index: number,
                                ) => (
                                    <TableRow key={item.name as string}>
                                        <td className="py-4">{item.name}</td>
                                        <td>
                                            {new Date(
                                                item.createdAt as number,
                                            ).toLocaleDateString()}
                                        </td>
                                        <td align="right">
                                            <Dialog2
                                                title={
                                                    APIKEY_REMOVE_DIALOG_HEADER
                                                }
                                                trigger={
                                                    <Button variant="soft">
                                                        {APIKEY_REMOVE_BTN}
                                                    </Button>
                                                }
                                                okButton={
                                                    <Button
                                                        onClick={() =>
                                                            removeApikey(
                                                                item.keyId,
                                                            )
                                                        }
                                                    >
                                                        {APIKEY_REMOVE_BTN}
                                                    </Button>
                                                }
                                            >
                                                {APIKYE_REMOVE_DIALOG_DESC}
                                            </Dialog2>
                                        </td>
                                    </TableRow>
                                ),
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Tabs>
        </div>
    );
};

const mapStateToProps = (state: AppState) => ({
    siteinfo: state.siteinfo,
    auth: state.auth,
    address: state.address,
    networkAction: state.networkAction,
    profile: state.profile,
    loading: state.networkAction,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
    dispatch: dispatch,
});

export default connect(mapStateToProps, mapDispatchToProps)(Settings);
