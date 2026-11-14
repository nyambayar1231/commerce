// Adapted from saleor-dashboard: src/orders/components/OrderCustomerAddressesEditDialog/
// (OrderCustomerAddressesEditDialog.tsx, OrderCustomerAddressEdit.tsx, messages.ts) and
// src/components/AddressEdit/AddressEdit.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Change customer shipping / billing address" for a draft: Saleor's address form (names,
// company, phone, address lines, city, postal code, country, country area), prefilled with the
// draft's address, and Saleor's "Set the same for billing / shipping address" checkbox. Our
// customers have no address book (PLAN M7), so Saleor's "use one of customer addresses" choice
// and its search are left out: this is Saleor's "Add new address" branch only. Field errors come
// from the API (OrderError.field + addressType).

import { useQuery } from "@apollo/client";
import { Box, Checkbox, Input, Select, Text } from "@saleor/macaw-ui";
import { useEffect, useMemo, useState } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import {
  type AddressFragment,
  type AddressInput,
  type CountryCode,
  type OrderErrorFragment,
  ShopCountriesDocument,
} from "../../../graphql/types.generated";
import { commonMessages } from "../../../intl";
import { getOrderErrorMessage } from "../../../utils/errors";

export type AddressKind = "SHIPPING" | "BILLING";

const messages = defineMessages({
  shippingTitle: { id: "129wyQ", defaultMessage: "Change customer shipping address" },
  billingTitle: { id: "D4W/LE", defaultMessage: "Change customer billing address" },
  sameForBilling: { id: "RzDYi8", defaultMessage: "Set the same for billing address" },
  sameForShipping: { id: "txOXvy", defaultMessage: "Set the same for shipping address" },
  company: { id: "9YazHG", defaultMessage: "Company" },
  phone: { id: "O95R3Z", defaultMessage: "Phone" },
  address1: { id: "B52Em/", defaultMessage: "Address line 1" },
  address2: { id: "oQY0a2", defaultMessage: "Address line 2" },
  city: { id: "TE4fIS", defaultMessage: "City" },
  postalCode: { id: "oYGfnY", defaultMessage: "ZIP / Postal code" },
  country: { id: "vONi+O", defaultMessage: "Country" },
  countryArea: { id: "AuwpCm", defaultMessage: "Country area" },
  confirm: { id: "N2IrpM", defaultMessage: "Confirm" },
});

type TextField = Exclude<keyof AddressInput, "country">;

type FormData = Record<TextField, string> & { country: string };

const EMPTY: FormData = {
  firstName: "",
  lastName: "",
  companyName: "",
  phone: "",
  streetAddress1: "",
  streetAddress2: "",
  city: "",
  cityArea: "",
  postalCode: "",
  country: "",
  countryArea: "",
};

const toFormData = (address: AddressFragment | null): FormData =>
  address
    ? {
        firstName: address.firstName,
        lastName: address.lastName,
        companyName: address.companyName,
        phone: address.phone ?? "",
        streetAddress1: address.streetAddress1,
        streetAddress2: address.streetAddress2,
        city: address.city,
        cityArea: address.cityArea,
        postalCode: address.postalCode,
        country: address.country.code,
        countryArea: address.countryArea,
      }
    : EMPTY;

/** The form as the API's AddressInput (empty strings stay: the API trims and checks them). */
export const toAddressInput = (data: FormData): AddressInput => ({
  ...data,
  country: (data.country || null) as CountryCode | null,
});

interface OrderAddressEditDialogProps {
  open: boolean;
  kind: AddressKind;
  address: AddressFragment | null;
  confirmButtonState: ConfirmButtonTransitionState;
  errors: OrderErrorFragment[];
  onClose: () => void;
  /** `alsoOther`: Saleor's "Set the same for …" — use it for the other address too. */
  onSubmit: (address: AddressInput, alsoOther: boolean) => void;
}

export const OrderAddressEditDialog = ({
  open,
  kind,
  address,
  confirmButtonState,
  errors,
  onClose,
  onSubmit,
}: OrderAddressEditDialogProps) => {
  const intl = useIntl();
  const [data, setData] = useState<FormData>(EMPTY);
  const [alsoOther, setAlsoOther] = useState(false);
  const { data: countriesData } = useQuery(ShopCountriesDocument, { skip: !open });
  const countries = useMemo(
    () =>
      (countriesData?.shop.countries ?? []).map((country) => ({
        value: country.code,
        label: country.country,
      })),
    [countriesData],
  );

  useEffect(() => {
    if (open) {
      setData(toFormData(address));
      setAlsoOther(false);
    }
  }, [open, address]);

  // Only this address's field errors go next to the fields; the rest are listed below.
  const fieldError = (field: keyof FormData) =>
    errors.find((error) => error.field === field && error.addressType === kind);
  const otherErrors = errors.filter(
    (error) => !(error.addressType === kind && error.field && error.field in EMPTY),
  );

  const textInput = (field: TextField, label: string) => {
    const error = fieldError(field);

    return (
      <Input
        name={field}
        label={label}
        value={data[field]}
        error={!!error}
        helperText={error ? getOrderErrorMessage(error, intl) : undefined}
        onChange={(event) => setData((current) => ({ ...current, [field]: event.target.value }))}
      />
    );
  };
  const countryError = fieldError("country");

  return (
    <DashboardModal onChange={onClose} open={open}>
      <DashboardModal.Content size="md">
        <DashboardModal.Header>
          <FormattedMessage
            {...(kind === "SHIPPING" ? messages.shippingTitle : messages.billingTitle)}
          />
        </DashboardModal.Header>
        <DashboardModal.Body>
          <Box
            display="grid"
            __gridTemplateColumns="1fr 1fr"
            gap={4}
            paddingX={6}
            paddingTop={2}
            paddingBottom={2}
            data-test-id="address-form"
          >
            {textInput("firstName", intl.formatMessage(commonMessages.firstName))}
            {textInput("lastName", intl.formatMessage(commonMessages.lastName))}
            {textInput("companyName", intl.formatMessage(messages.company))}
            {textInput("phone", intl.formatMessage(messages.phone))}
            <Box __gridColumn="1 / -1">
              {textInput("streetAddress1", intl.formatMessage(messages.address1))}
            </Box>
            <Box __gridColumn="1 / -1">
              {textInput("streetAddress2", intl.formatMessage(messages.address2))}
            </Box>
            {textInput("city", intl.formatMessage(messages.city))}
            {textInput("postalCode", intl.formatMessage(messages.postalCode))}
            <Select
              label={intl.formatMessage(messages.country)}
              name="country"
              data-test-id="address-country"
              options={countries}
              value={countries.find((country) => country.value === data.country) ?? null}
              error={!!countryError}
              helperText={countryError ? getOrderErrorMessage(countryError, intl) : undefined}
              onChange={(option) =>
                setData((current) => ({ ...current, country: option?.value ?? "" }))
              }
            />
            {textInput("countryArea", intl.formatMessage(messages.countryArea))}
            <Box __gridColumn="1 / -1">
              <Checkbox
                checked={alsoOther}
                onCheckedChange={(checked) => setAlsoOther(checked === true)}
                data-test-id="same-address-checkbox"
              >
                <Text>
                  <FormattedMessage
                    {...(kind === "SHIPPING" ? messages.sameForBilling : messages.sameForShipping)}
                  />
                </Text>
              </Checkbox>
            </Box>
            {otherErrors.map((error) => (
              <Text
                key={`${error.code}-${error.field}-${error.addressType}`}
                color="critical1"
                data-test-id="dialog-error"
              >
                {getOrderErrorMessage(error, intl)}
              </Text>
            ))}
          </Box>
        </DashboardModal.Body>
        <DashboardModal.Actions>
          <BackButton onClick={onClose} />
          <ConfirmButton
            transitionState={confirmButtonState}
            data-test-id="confirm-button"
            onClick={() => onSubmit(toAddressInput(data), alsoOther)}
          >
            <FormattedMessage {...messages.confirm} />
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};
