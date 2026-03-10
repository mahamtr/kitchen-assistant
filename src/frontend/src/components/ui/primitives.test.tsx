import { fireEvent, screen } from '@testing-library/react-native';
import {
  ActionButton,
  ChoiceChip,
  ConfirmDialog,
  EmptyState,
  OverlayCard,
  PillBadge,
  SearchField,
  SegmentedControl,
  SectionHeading,
  TextField,
} from './primitives';
import { renderWithProviders } from '../../test/render';

describe('visual primitives', () => {
  it('renders numeric action button labels through Text', () => {
    renderWithProviders(<ActionButton>{4}</ActionButton>);

    expect(screen.getByText('4')).toBeTruthy();
  });

  it('renders headings, badges, and empty states', () => {
    renderWithProviders(
      <>
        <SectionHeading title="Kitchen flow" subtitle="Review the current layout." accessory={<PillBadge label="Live" tone="accent" />} />
        <OverlayCard title="Inventory snapshot" subtitle="Aligned to the pen file.">
          <EmptyState
            title="Nothing is filtered out"
            description="This state should stay stable when the component palette changes."
            action={<ActionButton variant="secondary">Reset filters</ActionButton>}
          />
        </OverlayCard>
      </>,
    );

    expect(screen.getByText('Kitchen flow')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Nothing is filtered out')).toBeTruthy();
    expect(screen.getByText('Reset filters')).toBeTruthy();
  });

  it('renders single-line and multiline text fields', () => {
    const onSingleLineChange = jest.fn();
    const onMultilineChange = jest.fn();

    renderWithProviders(
      <>
        <TextField
          label="Ingredient"
          value="Tomatoes"
          onChangeText={onSingleLineChange}
          placeholder="Search ingredients"
        />
        <TextField
          label="Notes"
          value="Use the produce drawer."
          onChangeText={onMultilineChange}
          placeholder="Add prep notes"
          multiline
        />
      </>,
    );

    fireEvent.changeText(screen.getByDisplayValue('Tomatoes'), 'Cherry tomatoes');
    fireEvent.changeText(screen.getByDisplayValue('Use the produce drawer.'), 'Use the cool shelf.');

    expect(onSingleLineChange).toHaveBeenCalledWith('Cherry tomatoes');
    expect(onMultilineChange).toHaveBeenCalledWith('Use the cool shelf.');
    expect(screen.getByText('Ingredient')).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
  });

  it('wires segmented and chip interactions', () => {
    const onSegmentChange = jest.fn();
    const onChoicePress = jest.fn();

    renderWithProviders(
      <>
        <SegmentedControl
          value="to-buy"
          onValueChange={onSegmentChange}
          options={[
            { label: 'To Buy', value: 'to-buy' },
            { label: 'In Stock', value: 'in-stock' },
          ]}
        />
        <ChoiceChip
          label="Vegetarian"
          description="Bias the weekly plan toward plant-first meals."
          selected={false}
          onPress={onChoicePress}
        />
      </>,
    );

    fireEvent.press(screen.getByText('In Stock'));
    fireEvent.press(screen.getByText('Vegetarian'));

    expect(onSegmentChange).toHaveBeenCalledWith('in-stock');
    expect(onChoicePress).toHaveBeenCalledTimes(1);
  });

  it('renders searchable content and confirm dialogs', () => {
    const onSearchChange = jest.fn();
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <>
        <SearchField value="lem" onChangeText={onSearchChange} placeholder="Find an item" />
        <ConfirmDialog
          visible
          title="Apply OCR changes"
          description="This commits the reviewed lines to inventory."
          confirmLabel="Apply"
          cancelLabel="Back"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </>,
    );

    fireEvent.changeText(screen.getByDisplayValue('lem'), 'lemon');
    fireEvent.press(screen.getByText('Back'));
    fireEvent.press(screen.getByText('Apply'));

    expect(onSearchChange).toHaveBeenCalledWith('lemon');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByText('This action updates your mock data immediately.')).toBeTruthy();
  });

  it('does not render a confirm dialog when hidden', () => {
    renderWithProviders(
      <ConfirmDialog
        visible={false}
        title="Remove item"
        description="Should not be visible."
        confirmLabel="Remove"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.queryByText('Remove item')).toBeNull();
  });
});
